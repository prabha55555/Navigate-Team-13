/**
 * Adaptive learning: per-topic mastery for a student in a course, AI study
 * recommendations (with template fallback) and personal practice quizzes.
 *
 * Mastery for a topic = points earned / points possible on that topic's
 * questions, across the student's latest finished attempt of every graded
 * (non-practice) assessment whose results the student can see.
 */
const Assessment = require('../models/Assessment');
const QuestionBankItem = require('../models/QuestionBankItem');
const Submission = require('../models/Submission');
const curriculumService = require('./curriculumService');
const syllabusAnalyzerService = require('./syllabusAnalyzerService');
const attempts = require('./attemptService');
const { cleanQuestion, hasValidKey } = require('./questions');
const { canonicalTopic, topicKey } = require('./topics');
const { FINISHED, bestByAssessment, roundHalfUp } = require('./scoring');
const { consumeAi, releaseAi } = require('./plans');
const { badRequest } = require('../utils/errors');
const logger = require('../utils/logger');

const AI_TIMEOUT_MS = 20 * 1000;
const PRACTICE_AI_TIMEOUT_MS = 30 * 1000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// After an AI failure, serve the templates for a while instead of making every visit wait for the timeout again.
const FALLBACK_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 2000;
const MAX_RECOMMENDED_TOPICS = 3;

const recommendationCache = new Map(); // key -> { value, status, expires }
const inFlight = new Map(); // key -> background AI job

const pct = (earned, possible) => (possible > 0 ? roundHalfUp((earned / possible) * 100) : null);

function statusFor(mastery) {
  if (mastery === null) return 'not-assessed';
  if (mastery >= 80) return 'mastered';
  if (mastery >= 50) return 'developing';
  return 'needs-work';
}

function levelFor(overall) {
  if (overall !== null && overall >= 80) return 'advanced';
  if (overall !== null && overall >= 50) return 'intermediate';
  return 'beginner';
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
  ]).finally(() => clearTimeout(timer));
}

/** Per-topic mastery for one student in one course. */
async function computeMastery(course, studentId) {
  const assessments = await Assessment.find({
    course: course._id, isPractice: { $ne: true }, status: { $in: ['published', 'closed'] }
  }).select('questions.id questions.topic resultsPolicy resultsReleased dueDate').lean();
  const visible = assessments.filter((a) => attempts.resultsVisible(a));
  const submissions = await Submission.find({
    student: studentId,
    assessment: { $in: visible.map((a) => a._id) },
    status: { $in: FINISHED }
  }).select('assessment status score maxScore questionResults').lean();
  // Official basis: the best graded attempt of each assessment.
  const best = bestByAssessment(submissions);

  // Canonical course topics first (their spelling wins), then other question topics.
  const canonical = (t) => canonicalTopic(t, course.topics);
  const names = new Map();
  [...(course.topics || []), ...assessments.flatMap((a) => a.questions.map((q) => canonical(q.topic)))]
    .filter((t) => String(t || '').trim())
    .forEach((t) => { if (!names.has(topicKey(t))) names.set(topicKey(t), String(t).trim()); });

  const totals = new Map(); // topicKey -> { earned, possible, attempts }
  let earnedAll = 0;
  let possibleAll = 0;
  visible.forEach((a) => {
    const s = best.get(String(a._id));
    if (!s) return;
    const topicOf = new Map(a.questions.map((q) => [q.id, topicKey(canonical(q.topic))]));
    s.questionResults.forEach((r) => {
      earnedAll += r.pointsEarned || 0;
      possibleAll += r.maxPoints || 0;
      const key = topicOf.get(r.questionId);
      if (!key) return;
      const t = totals.get(key) || { earned: 0, possible: 0, attempts: 0 };
      t.earned += r.pointsEarned || 0;
      t.possible += r.maxPoints || 0;
      t.attempts += 1;
      totals.set(key, t);
    });
  });

  const topics = [...names.entries()].map(([key, topic]) => {
    const t = totals.get(key);
    const mastery = t ? pct(t.earned, t.possible) : null;
    return { topic, mastery, status: statusFor(mastery), attempts: t ? t.attempts : 0 };
  });
  return { topics, overallMastery: pct(earnedAll, possibleAll), gradedAssessments: best.size };
}

/** Template recommendations used when AI is unavailable. */
function templateRecommendation(topic, status) {
  const tips = status === 'not-assessed'
    ? [
      `Read the course notes on ${topic} before the next assessment.`,
      `Write down three key terms from ${topic} and explain each in one sentence.`,
      `Try a short practice quiz on ${topic} to find out where you stand.`
    ]
    : [
      `Review the questions you missed on ${topic} and note why the correct answer is right.`,
      `Summarise the core ideas of ${topic} in your own words, then check them against the course notes.`,
      `Work through a few practice problems on ${topic}, starting with easier ones.`,
      `Take a personal practice quiz on ${topic} and aim for 80% or more.`
    ];
  return {
    topic,
    tips,
    resources: [
      { title: `${topic}: course notes and lecture slides`, type: 'reading' },
      { title: `${topic}: worked examples`, type: 'exercise' },
      { title: `${topic}: practice quiz`, type: 'quiz' }
    ],
    source: 'template'
  };
}

async function aiRecommendations(course, focus) {
  const prompt = `You are a supportive tutor for the course "${course.title}".
A student needs help with these topics (mastery percent in brackets, "n/a" = not assessed yet):
${focus.map((t) => `- ${t.topic} [${t.mastery === null ? 'n/a' : `${t.mastery}%`}]`).join('\n')}

Return ONLY a JSON array, one object per topic, in this exact shape:
[{"topic": "<topic>", "tips": ["<3 short, concrete study actions>"], "resources": [{"title": "<resource description>", "type": "video|reading|exercise|quiz"}]}]
Use at most 3 resources per topic. Do not invent URLs.`;
  const text = await curriculumService.generateText(prompt, { timeoutMs: AI_TIMEOUT_MS });
  const parsed = curriculumService.parseModelJson(String(text || ''));
  if (!Array.isArray(parsed)) throw new Error('AI returned no recommendations');
  const byTopic = new Map(parsed.filter((r) => r && r.topic).map((r) => [topicKey(r.topic), r]));
  return focus.map((t) => {
    const r = byTopic.get(topicKey(t.topic));
    const tips = r && Array.isArray(r.tips) ? r.tips.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) : [];
    if (!tips.length) return templateRecommendation(t.topic, t.status);
    const resources = Array.isArray(r.resources)
      ? r.resources.filter((x) => x && x.title).slice(0, 3).map((x) => ({
        title: String(x.title).slice(0, 200),
        type: ['video', 'reading', 'exercise', 'quiz'].includes(x.type) ? x.type : 'reading'
      }))
      : [];
    return { topic: t.topic, tips, resources, source: 'ai' };
  });
}

function cacheRecommendations(key, value, status) {
  if (recommendationCache.size >= CACHE_MAX) recommendationCache.delete(recommendationCache.keys().next().value);
  recommendationCache.set(key, { value, status, expires: Date.now() + (status === 'ai' ? CACHE_TTL_MS : FALLBACK_TTL_MS) });
}

/**
 * Recommendations for the weakest topics. Never waits for AI: on a cache miss
 * it returns the templates with status 'pending' and generates the AI version
 * in the background (bounded by AI_TIMEOUT_MS) into a cache keyed by
 * (student, course, weak topic set). Later calls get status 'ai' (cached 6 h)
 * or 'fallback' when AI failed or is not configured (cached 10 min, then retried).
 * @returns {{ recommendations: object[], status: 'ai'|'pending'|'fallback' }}
 */
function recommendationsFor(course, studentId, topics) {
  const weak = topics.filter((t) => t.status === 'needs-work' || t.status === 'developing')
    .sort((a, b) => a.mastery - b.mastery);
  const focus = (weak.length ? weak : topics.filter((t) => t.status === 'not-assessed')).slice(0, MAX_RECOMMENDED_TOPICS);
  if (!focus.length) return { recommendations: [], status: 'fallback' };

  const key = `${studentId}|${course._id}|${focus.map((t) => topicKey(t.topic)).sort().join(',')}`;
  const cached = recommendationCache.get(key);
  if (cached && cached.expires > Date.now()) return { recommendations: cached.value, status: cached.status };

  const templates = focus.map((t) => templateRecommendation(t.topic, t.status));
  if (!curriculumService.isAiConfigured()) {
    cacheRecommendations(key, templates, 'fallback');
    return { recommendations: templates, status: 'fallback' };
  }
  if (!inFlight.has(key)) {
    const job = aiRecommendations(course, focus)
      .then((value) => cacheRecommendations(key, value, value.some((r) => r.source === 'ai') ? 'ai' : 'fallback'))
      .catch((err) => {
        logger.info('learning_path.ai_fallback', { reason: err.message });
        cacheRecommendations(key, templates, 'fallback');
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  return { recommendations: templates, status: 'pending' };
}

/** Resolves once background recommendation jobs started so far have finished (tests, shutdown). */
async function whenIdle() {
  await Promise.all([...inFlight.values()]);
}

/** The next assessment in the course the student can start, earliest due first. */
async function nextAssessmentFor(course, studentId) {
  const now = new Date();
  const candidates = await Assessment.find({
    course: course._id,
    isPractice: { $ne: true },
    status: 'published',
    $and: [
      { $or: [{ availableFrom: null }, { availableFrom: { $lte: now } }] },
      { $or: [{ dueDate: null }, { dueDate: { $gt: now } }] }
    ]
  }).select('title dueDate maxAttempts status availableFrom').sort({ dueDate: 1 }).limit(20).lean();
  const mine = await Submission.find({ student: studentId, assessment: { $in: candidates.map((a) => a._id) } })
    .select('assessment status percentage attempt deadlineAt').lean();
  const next = candidates.find((a) => {
    const status = attempts.computeMyStatus(a, mine.filter((s) => String(s.assessment) === String(a._id)), now);
    return status.canStart && status.attempts === 0;
  });
  return next ? { id: String(next._id), title: next.title, dueDate: next.dueDate || null } : null;
}

async function getLearningPath(course, studentId) {
  const { topics, overallMastery } = await computeMastery(course, studentId);
  const { recommendations, status } = recommendationsFor(course, studentId, topics);
  return {
    courseId: String(course._id),
    overallMastery,
    level: levelFor(overallMastery),
    topics,
    recommendations,
    recommendationsStatus: status,
    nextAssessment: await nextAssessmentFor(course, studentId)
  };
}

// ---------------------------------------------------------------------------
// Personal practice quizzes
// ---------------------------------------------------------------------------

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Valid, auto-gradable questions from the AI quick-quiz generator; [] when AI is unavailable. */
async function aiPracticeQuestions(course, topics, count) {
  if (!curriculumService.isAiConfigured()) return [];
  try {
    const quiz = await withTimeout(syllabusAnalyzerService.generateQuickQuiz(
      {
        basicInfo: { courseTitle: course.title, courseCode: course.code, academicLevel: 'Undergraduate' },
        learningOutcomes: { keyTopics: topics }
      },
      { questionCount: count, difficulty: 'mixed', topicFocus: topics, questionTypes: ['multiple-choice', 'true-false'] }
    ), PRACTICE_AI_TIMEOUT_MS, 'Practice quiz generation timed out');
    if (!quiz || quiz.generatedBy !== 'gemini') return [];
    return (quiz.questions || [])
      .map((q, i) => {
        try { return cleanQuestion({ ...q, id: undefined, explanation: '' }, i); } catch (err) { return null; }
      })
      .filter((q) => q && hasValidKey(q));
  } catch (err) {
    logger.info('practice.ai_fallback', { reason: err.message });
    return [];
  }
}

// Open-ended practice prompts used when no stored questions are left. `{t}` is the topic.
const PRACTICE_PROMPTS = [
  ['short-answer', 'In your own words, explain the most important idea in {t}.'],
  ['short-answer', 'Give one real-world example where {t} is used, and say why it fits.'],
  ['short-answer', 'Define three key terms from {t} in one sentence each.'],
  ['essay', 'Describe a common mistake students make with {t} and how to avoid it.'],
  ['short-answer', 'What question about {t} would you ask your instructor, and why?'],
  ['essay', 'Explain {t} to a classmate who missed the lecture, using a small worked example.'],
  ['short-answer', 'Which part of {t} do you find hardest? Write down the step where you usually get stuck.'],
  ['short-answer', 'Summarise {t} in two or three sentences without looking at your notes.'],
  ['essay', 'Compare two approaches or ideas within {t}. When would you choose each one?'],
  ['short-answer', 'List the steps you would follow to solve a typical problem on {t}.'],
  ['short-answer', 'How does {t} connect to another topic in this course?'],
  ['essay', 'Write your own exam-style question on {t}, then answer it.'],
  ['short-answer', 'What would go wrong if {t} were applied incorrectly? Give a concrete case.'],
  ['short-answer', 'Name one assumption or limitation that matters when using {t}.'],
  ['essay', 'Reflect on a question about {t} you got wrong: why was your answer wrong and what is the correct reasoning?']
];

/** Distinct prompts, cycling through the topics first so every topic is covered. */
function promptQuestions(topics, count) {
  const out = [];
  for (let i = 0; out.length < count && i < topics.length * PRACTICE_PROMPTS.length; i += 1) {
    const topic = topics[i % topics.length];
    const [type, template] = PRACTICE_PROMPTS[Math.floor(i / topics.length)];
    out.push({
      type,
      text: template.replace('{t}', topic),
      topic,
      points: type === 'essay' ? 3 : 2,
      difficulty: 'Medium',
      explanation: `Check your answer against the course notes on ${topic}, or ask your instructor for feedback.`
    });
  }
  return out;
}

/** Stored questions a practice quiz can reuse: auto-gradable ones with a valid key. */
function reusable(raw, i) {
  try {
    const { id, ...q } = cleanQuestion(raw, i); // eslint-disable-line no-unused-vars
    const gradable = ['multiple-choice', 'multiple-select', 'true-false'].includes(q.type)
      || (q.type === 'short-answer' && q.correctAnswer);
    return gradable && hasValidKey(q) ? q : null;
  } catch (err) {
    return null;
  }
}

/**
 * Practice questions without AI, in order of preference: question-bank items
 * instructors opted in by tagging them `practice` (the bank is otherwise a
 * private exam library; chosen topics first, then any topic), questions from this course's
 * assessments that are already over (closed or past due; never live ones, so
 * no current answer key is revealed), then open-ended prompts per topic.
 * @param {object[]} already questions already chosen (e.g. from AI), not repeated
 */
async function fallbackPracticeQuestions(course, topics, count, already = []) {
  const now = new Date();
  const [bank, finished] = await Promise.all([
    QuestionBankItem.find({
      organization: course.organization,
      course: { $in: [course._id, null] },
      tags: /^practice$/i
    }).lean(),
    Assessment.find({
      course: course._id,
      isPractice: { $ne: true },
      $or: [{ status: 'closed' }, { status: 'published', dueDate: { $lt: now } }]
    }).select('questions').lean()
  ]);
  const wanted = new Set(topics.map(topicKey));
  const onTopic = (q) => wanted.has(topicKey(canonicalTopic(q.topic, course.topics)));
  const bankQs = bank.map(reusable).filter(Boolean);
  const pastQs = finished.flatMap((a) => a.questions).map(reusable).filter(Boolean);
  const ordered = [
    ...shuffle(bankQs.filter(onTopic)),
    ...shuffle(bankQs.filter((q) => !onTopic(q))),
    ...shuffle(pastQs.filter(onTopic)),
    ...shuffle(pastQs.filter((q) => !onTopic(q)))
  ];

  const seen = new Set(already.map((q) => q.text.trim().toLowerCase()));
  const picked = [];
  for (const q of [...ordered, ...promptQuestions(topics, count)]) {
    if (already.length + picked.length >= count) break;
    const key = q.text.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      picked.push(q);
    }
  }
  return picked;
}

/**
 * Creates a personal practice quiz for the student on `topics` (default: their
 * weakest topics). Uses one AI generation; refunded when AI could not be used.
 */
async function createPracticeQuiz(req, course, { topics: requested, questionCount }) {
  const count = Math.min(15, Math.max(5, parseInt(questionCount, 10) || 8));
  const { topics: mastery } = await computeMastery(course, req.user.id);
  let topics;
  if (Array.isArray(requested) && requested.length) {
    const known = new Map(mastery.map((t) => [topicKey(t.topic), t.topic]));
    topics = [...new Set(requested.map((t) => known.get(topicKey(canonicalTopic(t, course.topics)))).filter(Boolean))].slice(0, 5);
    if (!topics.length) throw badRequest('None of these topics belong to this course', { field: 'topics' });
  } else {
    const ranked = mastery.filter((t) => t.mastery !== null).sort((a, b) => a.mastery - b.mastery);
    topics = (ranked.length ? ranked.filter((t) => t.status !== 'mastered') : mastery)
      .slice(0, 3).map((t) => t.topic);
    if (!topics.length) topics = (ranked.length ? ranked : mastery).slice(0, 3).map((t) => t.topic);
    if (!topics.length) throw badRequest('This course has no topics to practise yet');
  }

  await consumeAi(req.user.organization, 1);
  let questions = (await aiPracticeQuestions(course, topics, count)).slice(0, count);
  let generatedBy = 'ai';
  if (questions.length < Math.ceil(count / 2)) {
    await releaseAi(req.user.organization, 1);
    questions = [];
    generatedBy = 'fallback';
  }
  // Always top up to the requested number of questions.
  questions = [...questions, ...(await fallbackPracticeQuestions(course, topics, count, questions))];

  const assessment = await Assessment.create({
    organization: req.user.organization,
    course: course._id,
    createdBy: req.user.id,
    title: `Practice: ${topics.join(', ')}`.slice(0, 200),
    description: 'A personal practice quiz on your weakest topics. It does not count towards your grade.',
    status: 'published',
    publishedAt: new Date(),
    maxAttempts: 10,
    timeLimit: 0,
    resultsPolicy: 'immediate',
    showCorrectAnswers: true,
    proctoring: { enabled: false },
    source: 'practice',
    isPractice: true,
    practiceFor: req.user.id,
    questions: questions.map((q, i) => ({ ...q, id: `p${i + 1}` }))
  });
  return { assessmentId: String(assessment._id), questionCount: assessment.questions.length, topics, generatedBy };
}

module.exports = { computeMastery, getLearningPath, createPracticeQuiz, statusFor, levelFor, whenIdle };
