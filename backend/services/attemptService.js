/**
 * Server-side assessment attempts: starting/resuming, autosave, integrity
 * events, final grading and the policy-aware result views.
 *
 * The server is the source of truth for time: `deadlineAt` is fixed when the
 * attempt starts and answers arriving more than GRACE_MS after it are refused.
 */
const crypto = require('crypto');
const Course = require('../models/Course');
const Submission = require('../models/Submission');
const Notification = require('../models/Notification');
const User = require('../models/User');
const gradingService = require('./gradingService');
const plagiarismService = require('./plagiarismService');
const { notify } = require('./notify');
const { AppError, conflict } = require('../utils/errors');
const logger = require('../utils/logger');
const { roundHalfUp } = require('./scoring');
const { canonicalTopic, topicBreakdown } = require('./topics');

const GRACE_MS = 30 * 1000;
const INSTRUCTOR_NOTIFY_WINDOW_MS = 60 * 60 * 1000;
const PLAGIARISM_TIMEOUT_MS = 30 * 1000;
const MIN_PLAGIARISM_ANSWER_LENGTH = 30;
const MAX_TEXT_ANSWER = 20000;
const MAX_SELECTIONS = 50;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/i;

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const roundPct = (value) => roundHalfUp(value);

// Background work (plagiarism, notifications) started after a response; tracked so it can be awaited on shutdown/tests.
const pending = new Set();
function runInBackground(label, task) {
  const promise = Promise.resolve()
    .then(task)
    .catch((err) => logger.warn(`${label}.failed`, { err }))
    .finally(() => pending.delete(promise));
  pending.add(promise);
}
/** Resolves once all background work started so far has finished. */
async function whenIdle() {
  while (pending.size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all([...pending]);
  }
}

/** Fisher-Yates shuffle using crypto randomness; returns a new array. */
function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Results are visible to students once released, immediately, or after the due date (per policy). */
function resultsVisible(assessment, now = new Date()) {
  if (assessment.resultsReleased || assessment.resultsPolicy === 'immediate') return true;
  if (assessment.resultsPolicy === 'after-due') return !assessment.dueDate || assessment.dueDate <= now;
  return false;
}

/** A question as a student may see it while answering: never the key or explanation. */
function studentQuestion(q, optionOrder) {
  const options = Array.isArray(optionOrder)
    ? optionOrder.map((i) => q.options[i]).filter((o) => o !== undefined)
    : [...(q.options || [])];
  return { id: q.id, type: q.type, text: q.text, options, points: q.points, topic: q.topic || '' };
}

/** Assessment metadata safe for students (no questions). */
function studentAssessmentSummary(assessment) {
  return {
    id: String(assessment._id),
    courseId: String(assessment.course),
    title: assessment.title,
    description: assessment.description,
    instructions: assessment.instructions,
    status: assessment.status,
    publishedAt: assessment.publishedAt,
    availableFrom: assessment.availableFrom || null,
    dueDate: assessment.dueDate || null,
    timeLimit: assessment.timeLimit,
    maxAttempts: assessment.maxAttempts,
    passingScore: assessment.passingScore,
    resultsPolicy: assessment.resultsPolicy,
    resultsReleased: assessment.resultsReleased,
    totalPoints: assessment.totalPoints,
    questionCount: (assessment.questions || []).length,
    proctoring: assessment.proctoring,
    isPractice: !!assessment.isPractice
  };
}

/**
 * Whether the student may start a new attempt (or resume one).
 * @param {object} assessment
 * @param {object[]} submissions the student's submissions for this assessment
 */
function computeMyStatus(assessment, submissions, now = new Date()) {
  const finished = submissions.filter((s) => s.status !== 'in-progress');
  const inProgress = submissions.find((s) => s.status === 'in-progress'
    && (!s.deadlineAt || s.deadlineAt.getTime() + GRACE_MS > now.getTime()));
  const visible = resultsVisible(assessment, now);
  const percentages = finished.map((s) => s.percentage).filter((p) => typeof p === 'number');
  const status = {
    attempts: finished.length,
    bestPercentage: visible && percentages.length ? Math.max(...percentages) : null,
    lastSubmissionId: finished.length
      ? String(finished.reduce((a, b) => (a.attempt > b.attempt ? a : b))._id)
      : null,
    attemptsRemaining: Math.max(0, assessment.maxAttempts - submissions.length),
    inProgress: !!inProgress,
    inProgressSubmissionId: inProgress ? String(inProgress._id) : null,
    canStart: true
  };
  let reason = null;
  if (inProgress) reason = 'in-progress';
  else if (assessment.status !== 'published') reason = 'closed';
  else if (assessment.availableFrom && assessment.availableFrom > now) reason = 'not-yet-available';
  else if (assessment.dueDate && assessment.dueDate <= now) reason = 'past-due';
  else if (submissions.length >= assessment.maxAttempts) reason = 'no-attempts-left';
  if (reason && reason !== 'in-progress') status.canStart = false;
  if (reason) status.reason = reason;
  return status;
}

const REASON_MESSAGES = {
  closed: 'This assessment is closed',
  'not-yet-available': 'This assessment is not open yet',
  'past-due': 'The due date for this assessment has passed',
  'no-attempts-left': 'You have used all your attempts for this assessment'
};

/** Only answers to real questions, with bounded sizes; anything else is dropped. */
function sanitizeAnswers(assessment, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
  const ids = new Set((assessment.questions || []).map((q) => q.id));
  const clean = {};
  Object.entries(answers).forEach(([qid, value]) => {
    if (!ids.has(qid)) return;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') clean[qid] = value;
    else if (typeof value === 'string') clean[qid] = value.slice(0, MAX_TEXT_ANSWER);
    else if (Array.isArray(value)) {
      clean[qid] = value.filter((v) => typeof v === 'string' || typeof v === 'number')
        .slice(0, MAX_SELECTIONS)
        .map((v) => String(v).slice(0, 1000));
    }
  });
  return clean;
}

const deadlinePassed = (submission, now = new Date()) =>
  !!submission.deadlineAt && now.getTime() > submission.deadlineAt.getTime() + GRACE_MS;

/** The attempt as the taking UI needs it: questions in the stored order, options in the stored shuffle. */
function attemptView(assessment, submission) {
  const byId = new Map((assessment.questions || []).map((q) => [q.id, q]));
  const order = submission.questionOrder && submission.questionOrder.length
    ? submission.questionOrder
    : (assessment.questions || []).map((q) => q.id);
  const optionOrder = submission.optionOrder || {};
  return {
    submission: {
      id: String(submission._id),
      attempt: submission.attempt,
      status: submission.status,
      startedAt: submission.startedAt,
      deadlineAt: submission.deadlineAt,
      serverNow: new Date(),
      answers: submission.answers || {},
      violationCount: (submission.integrity && submission.integrity.violationCount) || 0
    },
    assessment: {
      ...studentAssessmentSummary(assessment),
      questions: order.map((id) => byId.get(id)).filter(Boolean).map((q) => studentQuestion(q, optionOrder[q.id]))
    }
  };
}

/**
 * Starts a new attempt, or returns the student's in-progress one (so the same
 * attempt resumes on another device with the same question/option order).
 */
async function startAttempt(req, assessment) {
  const studentId = req.user.id;
  const existing = await Submission.findOne({ assessment: assessment._id, student: studentId, status: 'in-progress' });
  if (existing && !(await finalizeIfExpired(existing, assessment))) return existing;

  const submissions = await Submission.find({ assessment: assessment._id, student: studentId })
    .select('status percentage attempt deadlineAt')
    .lean();
  const status = computeMyStatus(assessment, submissions);
  if (!status.canStart) {
    throw new AppError(409, 'CONFLICT', REASON_MESSAGES[status.reason], { reason: status.reason });
  }

  const now = new Date();
  const questions = assessment.questions || [];
  const questionIds = questions.map((q) => q.id);
  let optionOrder;
  if (assessment.shuffleOptions) {
    optionOrder = {};
    questions
      .filter((q) => q.type === 'multiple-choice' || q.type === 'multiple-select')
      .forEach((q) => { optionOrder[q.id] = shuffled(q.options.map((_, i) => i)); });
  }
  // The attempt ends at the time limit, but never later than the due date.
  const limits = [];
  if (assessment.timeLimit > 0) limits.push(now.getTime() + assessment.timeLimit * 60 * 1000);
  if (assessment.dueDate) limits.push(assessment.dueDate.getTime());

  try {
    return await Submission.create({
      organization: assessment.organization,
      assessment: assessment._id,
      course: assessment.course,
      student: studentId,
      attempt: submissions.length + 1,
      isPractice: !!assessment.isPractice,
      status: 'in-progress',
      startedAt: now,
      deadlineAt: limits.length ? new Date(Math.min(...limits)) : null,
      answers: {},
      questionOrder: assessment.shuffleQuestions ? shuffled(questionIds) : questionIds,
      optionOrder
    });
  } catch (err) {
    // Two devices started at the same moment: the unique (assessment, student, attempt) index picked one.
    if (err && err.code === 11000) {
      const winner = await Submission.findOne({ assessment: assessment._id, student: studentId, status: 'in-progress' });
      if (winner) return winner;
      throw conflict('An attempt was just started; please retry');
    }
    throw err;
  }
}

/** Merges `answers` into an in-progress attempt (atomic per question). */
async function saveAnswers(submission, assessment, answers) {
  if (submission.status !== 'in-progress') throw conflict('This attempt has already been submitted');
  if (deadlinePassed(submission)) {
    await finalizeIfExpired(submission, assessment);
    throw conflict('Time is up for this attempt', { reason: 'deadline-passed' });
  }
  const clean = sanitizeAnswers(assessment, answers);
  const set = {};
  Object.entries(clean).forEach(([qid, value]) => { set[`answers.${qid}`] = value; });
  const savedAt = new Date();
  if (Object.keys(set).length) {
    const updated = await Submission.updateOne({ _id: submission._id, status: 'in-progress' }, { $set: set });
    if (!updated.matchedCount) throw conflict('This attempt has already been submitted');
  }
  return { savedAt, saved: Object.keys(clean).length };
}

/** Weakest topic (lowest share of points, below 100%) for the feedback sentence, or null. */
function weakestTopicOf(questions, questionResults, courseTopics) {
  const weakest = topicBreakdown(questions, questionResults, courseTopics)[0];
  return weakest && weakest.pct < 100 ? { topic: weakest.topic, percentage: roundHalfUp(weakest.pct) } : null;
}

/**
 * Builds the graded fields for a finished attempt.
 * @param {object} assessment
 * @param {object} answers
 * @param {string[]} [courseTopics] canonical topics of the course (for topic feedback)
 */
function gradeFields(assessment, answers, courseTopics = []) {
  const questions = (assessment.questions || []).map((q) => (typeof q.toObject === 'function' ? q.toObject() : q));
  const grade = gradingService.gradeSubmission({ questions }, answers, { passingScore: assessment.passingScore });
  // Keep answer keys out of stored feedback; result views add them only when allowed.
  const results = grade.questionResults.map((r) => ({
    ...r,
    feedback: String(r.feedback || '').replace(/\s*The correct answer (is|was):[\s\S]*$/, '').trim()
  }));
  const percentage = grade.maxScore > 0 ? roundPct((grade.score / grade.maxScore) * 100) : 0;
  const { aiFeedback, personalizedRecommendations } = gradingService.buildFeedback(
    { ...grade, percentage, questionResults: results },
    questions
  );
  const questionResults = results.map((r) => ({
    questionId: String(r.questionId),
    isCorrect: !!r.correct,
    pointsEarned: r.score,
    maxPoints: r.maxScore,
    feedback: r.feedback,
    needsReview: !!r.needsReview
  }));
  // Topic-aware feedback: canonical topic names, weakest first.
  const breakdown = topicBreakdown(questions, questionResults, courseTopics);
  aiFeedback.overallFeedback = gradingService.generateOverallFeedback({
    percentage,
    score: grade.score,
    maxScore: grade.maxScore,
    provisional: questionResults.some((r) => r.needsReview),
    weakestTopic: weakestTopicOf(questions, questionResults, courseTopics)
  });
  if (personalizedRecommendations) {
    personalizedRecommendations.practiceAreas = breakdown.filter((t) => t.pct < 100).map((t) => t.topic);
  }
  return {
    questionResults,
    score: grade.score,
    maxScore: grade.maxScore,
    percentage,
    isPassed: grade.isPassed,
    needsReview: questionResults.some((r) => r.needsReview),
    aiFeedback: { ...aiFeedback, recommendations: personalizedRecommendations }
  };
}

/**
 * Recomputes score / percentage / pass from questionResults and any manual
 * override, and refreshes the overall feedback sentence so it matches.
 * Mutates and returns the submission document.
 */
function recomputeTotals(submission, assessment, courseTopics = []) {
  const results = submission.questionResults || [];
  const earned = results.reduce((sum, r) => sum + (r.pointsEarned || 0), 0);
  const maxScore = results.reduce((sum, r) => sum + (r.maxPoints || 0), 0);
  const hasOverride = submission.override && typeof submission.override.score === 'number';
  const score = hasOverride ? Math.min(Math.max(submission.override.score, 0), maxScore) : earned;
  submission.score = score;
  submission.maxScore = maxScore;
  submission.percentage = maxScore > 0 ? roundPct((score / maxScore) * 100) : 0;
  submission.isPassed = maxScore > 0 && (score / maxScore) * 100 >= assessment.passingScore;
  submission.needsReview = !hasOverride && results.some((r) => r.needsReview);
  if (submission.aiFeedback) {
    submission.aiFeedback = {
      ...submission.aiFeedback,
      overallFeedback: gradingService.generateOverallFeedback({
        percentage: submission.percentage,
        score,
        maxScore,
        provisional: submission.needsReview,
        weakestTopic: weakestTopicOf(assessment.questions, results, courseTopics)
      })
    };
  }
  return submission;
}

/**
 * Grades and closes an in-progress attempt.
 * @param {object} submission mongoose document (in-progress)
 * @param {object} assessment mongoose document
 * @param {{ status?: 'submitted'|'terminated', answers?: object }} opts
 *        `answers` are merged first unless the deadline (plus grace) has passed.
 * @returns {Promise<{ submission, lateAnswersRejected: boolean }>}
 */
async function finalize(submission, assessment, { status = 'submitted', answers } = {}) {
  const now = new Date();
  const late = deadlinePassed(submission, now);
  const merged = { ...(submission.answers || {}) };
  const lateAnswersRejected = late && answers && Object.keys(sanitizeAnswers(assessment, answers)).length > 0;
  if (!late) Object.assign(merged, sanitizeAnswers(assessment, answers));

  // Time is measured on the server and stops at the deadline.
  const end = submission.deadlineAt && now > submission.deadlineAt ? submission.deadlineAt : now;
  const course = await Course.findById(submission.course).select('topics').lean();
  const fields = {
    ...gradeFields(assessment, merged, course ? course.topics : []),
    answers: merged,
    status,
    submittedAt: end,
    timeSpent: Math.max(0, Math.round((end - submission.startedAt) / 1000))
  };
  if (status === 'terminated') fields['integrity.terminated'] = true;

  const updated = await Submission.findOneAndUpdate(
    { _id: submission._id, status: 'in-progress' },
    { $set: fields },
    { new: true }
  );
  if (!updated) throw conflict('This attempt has already been submitted');
  runInBackground('submission.post_submit', () => afterSubmit(updated, assessment));
  return { submission: updated, lateAnswersRejected: !!lateAnswersRejected };
}

/** Auto-submits an in-progress attempt whose deadline (plus grace) has passed. Returns true if it did. */
async function finalizeIfExpired(submission, assessment) {
  if (submission.status !== 'in-progress' || !deadlinePassed(submission)) return false;
  try {
    await finalize(submission, assessment);
  } catch (err) {
    if (!(err instanceof AppError && err.status === 409)) throw err;
  }
  return true;
}

/**
 * Records an integrity event; terminates (auto-submits as 'terminated') when
 * proctoring is on and the violation limit is reached.
 */
async function recordEvent(submission, assessment, { type, detail }) {
  if (submission.status !== 'in-progress') throw conflict('This attempt has already been submitted');
  const event = { type: EVENT_TYPE_PATTERN.test(String(type || '')) ? String(type) : 'other', at: new Date() };
  if (detail !== undefined && detail !== null) event.detail = String(detail).slice(0, 500);
  const updated = await Submission.findOneAndUpdate(
    { _id: submission._id, status: 'in-progress' },
    {
      $inc: { 'integrity.violationCount': 1 },
      $push: { 'integrity.events': { $each: [event], $slice: -Submission.MAX_INTEGRITY_EVENTS } }
    },
    { new: true }
  );
  if (!updated) throw conflict('This attempt has already been submitted');
  const count = updated.integrity.violationCount;
  const proctoring = assessment.proctoring || {};
  if (proctoring.enabled && count >= (proctoring.maxViolations || 5)) {
    try {
      await finalize(updated, assessment, { status: 'terminated' });
    } catch (err) {
      if (!(err instanceof AppError && err.status === 409)) throw err;
    }
    return { violationCount: count, terminated: true };
  }
  return { violationCount: count, terminated: false };
}

/** Plagiarism check for written answers, bounded by a timeout; stores the result on the submission. */
async function checkPlagiarism(submission, assessment) {
  const typeById = new Map((assessment.questions || []).map((q) => [q.id, q.type]));
  const isWritten = (qid) => ['short-answer', 'essay'].includes(typeById.get(qid));
  const answers = Object.entries(submission.answers || {})
    .filter(([qid, a]) => isWritten(qid) && typeof a === 'string' && a.trim().length > MIN_PLAGIARISM_ANSWER_LENGTH)
    .map(([questionId, answer]) => ({ questionId, answer, questionType: typeById.get(questionId) }));
  if (!answers.length) return;

  const others = await Submission.find({
    assessment: submission.assessment,
    student: { $ne: submission.student },
    status: { $ne: 'in-progress' }
  }).select('student answers').sort({ submittedAt: -1 }).limit(200).lean();
  const previousSubmissions = others.map((s) => ({
    id: String(s._id),
    studentId: String(s.student),
    answers: Object.entries(s.answers || {})
      .filter(([qid, a]) => isWritten(qid) && typeof a === 'string')
      .map(([questionId, answer]) => ({ questionId, answer }))
  }));

  let timer;
  const result = await Promise.race([
    plagiarismService.checkSubmission({
      submissionId: String(submission._id),
      studentId: String(submission.student),
      assessmentId: String(submission.assessment),
      answers,
      assessmentDetails: { title: assessment.title, questions: assessment.questions },
      previousSubmissions
    }),
    new Promise((resolve) => { timer = setTimeout(() => resolve(null), PLAGIARISM_TIMEOUT_MS); })
  ]).finally(() => clearTimeout(timer));

  const plagiarism = result
    ? {
      checkedAt: new Date(),
      isPlagiarismDetected: !!result.isPlagiarismDetected,
      overallSimilarityScore: result.overallSimilarityScore || 0,
      aiGeneratedContentDetected: !!result.aiGeneratedContentDetected,
      similarityMatches: (result.similarityMatches || []).slice(0, 20),
      detectionMethods: result.detectionMethods || []
    }
    : { checkedAt: new Date(), status: 'timeout' };
  await Submission.updateOne({ _id: submission._id }, { $set: { plagiarism } });
}

/**
 * Tells the course instructors about a new submission, at most once per
 * assessment per instructor per hour (later submissions in the hour are batched).
 */
async function notifyInstructors(submission, assessment) {
  const course = await Course.findById(submission.course).select('instructors title').lean();
  if (!course || !course.instructors.length) return;
  const link = `/app/assessments/${assessment._id}`;
  const recentlyNotified = await Notification.find({
    organization: submission.organization,
    user: { $in: course.instructors },
    type: 'submission.received',
    link,
    createdAt: { $gte: new Date(Date.now() - INSTRUCTOR_NOTIFY_WINDOW_MS) }
  }).distinct('user');
  const recipients = course.instructors.filter((i) => !recentlyNotified.some((r) => sameId(r, i)));
  if (!recipients.length) return;
  const student = await User.findById(submission.student).select('name').lean();
  await notify(recipients, {
    type: 'submission.received',
    title: `New submission: ${assessment.title}`,
    body: `${student ? student.name : 'A student'} submitted "${assessment.title}" (${course.title}).`,
    link
  }, submission.organization);
}

async function afterSubmit(submission, assessment) {
  const tasks = [checkPlagiarism(submission, assessment)];
  if (!assessment.isPractice) tasks.push(notifyInstructors(submission, assessment));
  const results = await Promise.allSettled(tasks);
  results.filter((r) => r.status === 'rejected')
    .forEach((r) => logger.warn('submission.after_submit_failed', { err: r.reason }));
}

/**
 * Result view of a submission.
 * Staff always see everything. Students see scores and per-question detail
 * only once results are released, and answer keys/explanations only when
 * `showCorrectAnswers` is on.
 */
function submissionView(submission, assessment, { forStaff = false, student = null, course = null } = {}) {
  // `released` is the real release state; staff see the full result either way.
  const released = resultsVisible(assessment);
  const courseTopics = (course && course.topics) || [];
  const view = {
    id: String(submission._id),
    assessment: {
      id: String(assessment._id),
      title: assessment.title,
      totalPoints: assessment.totalPoints,
      passingScore: assessment.passingScore,
      resultsPolicy: assessment.resultsPolicy,
      showCorrectAnswers: assessment.showCorrectAnswers,
      isPractice: !!assessment.isPractice
    },
    course: course ? { id: String(course._id), title: course.title } : { id: String(submission.course) },
    attempt: submission.attempt,
    status: submission.status,
    startedAt: submission.startedAt,
    deadlineAt: submission.deadlineAt,
    submittedAt: submission.submittedAt || null,
    timeSpent: submission.timeSpent,
    released,
    integrity: {
      violationCount: submission.integrity.violationCount,
      terminated: submission.integrity.terminated
    }
  };
  if (student) view.student = { id: String(student._id), name: student.name, email: student.email };
  if (submission.status === 'in-progress' || !(released || forStaff)) return view;

  const showKey = forStaff || assessment.showCorrectAnswers;
  const resultById = new Map((submission.questionResults || []).map((r) => [r.questionId, r]));
  const byId = new Map((assessment.questions || []).map((q) => [q.id, q]));
  const order = submission.questionOrder && submission.questionOrder.length
    ? submission.questionOrder
    : (assessment.questions || []).map((q) => q.id);
  const answers = submission.answers || {};

  Object.assign(view, {
    score: submission.score,
    maxScore: submission.maxScore,
    percentage: submission.percentage,
    isPassed: submission.isPassed,
    needsReview: submission.needsReview,
    override: submission.override && (typeof submission.override.score === 'number' || submission.override.comment)
      ? {
        score: typeof submission.override.score === 'number' ? submission.override.score : null,
        comment: submission.override.comment || '',
        at: submission.override.at
      }
      : null,
    aiFeedback: submission.aiFeedback || null,
    // Points per canonical course topic, weakest first.
    topicBreakdown: topicBreakdown(assessment.questions, submission.questionResults, courseTopics)
      .map((t) => ({ topic: t.topic, pointsEarned: t.pointsEarned, maxPoints: t.maxPoints, percentage: roundHalfUp(t.pct) })),
    questions: order.map((id) => byId.get(id)).filter(Boolean).map((q) => {
      const r = resultById.get(q.id);
      const item = {
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options,
        points: q.points,
        topic: canonicalTopic(q.topic, courseTopics),
        difficulty: q.difficulty,
        answer: answers[q.id] === undefined ? null : answers[q.id],
        result: r
          ? { isCorrect: r.isCorrect, pointsEarned: r.pointsEarned, maxPoints: r.maxPoints, feedback: r.feedback, needsReview: r.needsReview }
          : null
      };
      if (showKey) {
        item.correctAnswer = q.correctAnswer;
        item.explanation = q.explanation;
      }
      return item;
    })
  });
  if (forStaff) {
    view.integrity.events = submission.integrity.events;
    view.plagiarism = submission.plagiarism || null;
  }
  return view;
}

module.exports = {
  GRACE_MS,
  resultsVisible,
  studentAssessmentSummary,
  computeMyStatus,
  sanitizeAnswers,
  attemptView,
  gradeFields,
  startAttempt,
  saveAnswers,
  finalize,
  finalizeIfExpired,
  recordEvent,
  recomputeTotals,
  submissionView,
  whenIdle
};
