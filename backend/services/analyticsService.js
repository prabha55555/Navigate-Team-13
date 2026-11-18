/**
 * Analytics for staff dashboards, courses, single assessments and students.
 *
 * Every average and pass rate uses the official basis from services/scoring.js:
 * one data point per student per assessment, that student's BEST graded
 * attempt (finished, non-practice, published/closed assessments, current
 * roster only). Averages are rounded once, half up, to one decimal; item
 * analysis indexes are 0-1 with two decimals. Topics are grouped by the
 * course's canonical topic names (services/topics.js).
 */
const Assessment = require('../models/Assessment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Submission = require('../models/Submission');
const User = require('../models/User');
const attempts = require('./attemptService');
const {
  FINISHED, roundHalfUp, percentOf, mean, averagePercent, activeRoster, bestAttempts, bestByAssessment,
  courseStandings, summarizeStandings
} = require('./scoring');
const { canonicalTopic, topicKey } = require('./topics');

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ITEM_ANALYSIS_SUBMISSIONS = 5;
const TREND_WEEKS = 8;

const round1 = (n) => roundHalfUp(n, 1);
const round2 = (n) => roundHalfUp(n, 2);

function median(xs) {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Ten buckets '0-9' … '80-89', '90-100'. */
function scoreDistribution(percentages) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: i === 9 ? '90-100' : `${i * 10}-${i * 10 + 9}`, count: 0 }));
  percentages.forEach((p) => {
    if (typeof p !== 'number') return;
    buckets[Math.min(9, Math.max(0, Math.floor(p / 10)))].count += 1;
  });
  return buckets;
}

/** Monday 00:00 UTC of the week containing `date`. */
function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/** Average / median / extremes / pass rate of best-attempt documents (each has `pct`, `isPassed`). */
function classSummary(docs) {
  const pcts = docs.map((d) => d.pct);
  return {
    averageScore: averagePercent(pcts),
    median: round1(median(pcts)),
    highest: pcts.length ? round1(Math.max(...pcts)) : null,
    lowest: pcts.length ? round1(Math.min(...pcts)) : null,
    passRate: docs.length ? round1((docs.filter((d) => d.isPassed).length / docs.length) * 100) : null
  };
}

/**
 * Classical item analysis.
 *  - difficultyIndex (p-value): mean fraction of the item's points earned.
 *  - discriminationIndex: mean item fraction in the top 27% of students (by
 *    total score) minus the bottom 27%.
 * Needs at least MIN_ITEM_ANALYSIS_SUBMISSIONS submissions, otherwise the
 * indexes and flag are null. Flags are decided on the reported (rounded) values.
 * @param {object[]} questions assessment questions
 * @param {object[]} submissions one per student, with `pct` (or percentage) and questionResults
 * @param {string[]} [courseTopics] canonical course topics
 */
function itemAnalysis(questions, submissions, courseTopics = []) {
  const enough = submissions.length >= MIN_ITEM_ANALYSIS_SUBMISSIONS;
  const total = (s) => (typeof s.pct === 'number' ? s.pct : s.percentage || 0);
  const ranked = [...submissions].sort((a, b) => total(b) - total(a));
  const groupSize = Math.max(1, Math.round(ranked.length * 0.27));
  const upper = ranked.slice(0, groupSize);
  const lower = ranked.slice(-groupSize);

  const resultFor = (s, qid) => (s.questionResults || []).find((x) => x.questionId === qid);
  const fraction = (s, qid) => {
    const r = resultFor(s, qid);
    return r && r.maxPoints > 0 ? (r.pointsEarned || 0) / r.maxPoints : 0;
  };
  const points = (s, qid) => {
    const r = resultFor(s, qid);
    return r ? r.pointsEarned || 0 : 0;
  };

  return questions.map((q) => {
    const item = {
      questionId: q.id,
      text: q.text,
      topic: canonicalTopic(q.topic, courseTopics),
      type: q.type,
      points: q.points,
      averagePoints: round2(mean(submissions.map((s) => points(s, q.id)))),
      difficultyIndex: null,
      discriminationIndex: null,
      flag: null
    };
    if (!enough) return item;
    const p = round2(mean(submissions.map((s) => fraction(s, q.id))));
    const d = round2(mean(upper.map((s) => fraction(s, q.id))) - mean(lower.map((s) => fraction(s, q.id))));
    item.difficultyIndex = p;
    item.discriminationIndex = d;
    if (p > 0.9) item.flag = 'too-easy';
    else if (p < 0.3) item.flag = 'too-hard';
    else if (d < 0.2) item.flag = 'poor-discrimination';
    return item;
  });
}

/**
 * Students at risk in the given courses (current roster only): average of best
 * attempts below 50% over at least 2 graded assessments, or a terminated
 * attempt in the last 30 days.
 */
async function atRiskStudents(courseIds, courseTitleById, now = new Date()) {
  if (!courseIds.length) return [];
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const [best, roster, terminated] = await Promise.all([
    bestAttempts({ courseIds }),
    activeRoster(courseIds),
    Submission.aggregate([
      { $match: { course: { $in: courseIds }, status: 'terminated', isPractice: { $ne: true }, submittedAt: { $gte: since } } },
      { $group: { _id: { s: '$student', c: '$course' } } }
    ])
  ]);
  const rows = new Map();
  const rowFor = (student, course) => {
    const key = `${student}:${course}`;
    if (!rows.has(key)) rows.set(key, { student, course, pcts: [], reasons: [] });
    return rows.get(key);
  };
  best.forEach((d) => rowFor(d.student, d.course).pcts.push(d.pct));
  rows.forEach((r) => {
    if (r.pcts.length >= 2 && mean(r.pcts) < 50) r.reasons.push('low-average');
  });
  terminated.forEach((t) => {
    if (roster.pairs.has(`${t._id.s}:${t._id.c}`)) rowFor(t._id.s, t._id.c).reasons.push('terminated-attempt');
  });
  const flagged = [...rows.values()].filter((r) => r.reasons.length);
  const users = await User.find({ _id: { $in: flagged.map((r) => r.student) } }).select('name email').lean();
  const userBy = new Map(users.map((u) => [String(u._id), u]));
  return flagged
    .filter((r) => userBy.has(String(r.student)))
    .map((r) => ({
      id: String(r.student),
      name: userBy.get(String(r.student)).name,
      email: userBy.get(String(r.student)).email,
      courseId: String(r.course),
      courseTitle: courseTitleById.get(String(r.course)) || '',
      averageScore: averagePercent(r.pcts),
      gradedAssessments: r.pcts.length,
      reasons: r.reasons
    }))
    .sort((a, b) => (a.averageScore ?? 101) - (b.averageScore ?? 101));
}

/**
 * Weekly activity: number of finished attempts, and the average of the best
 * graded attempt per (student, assessment) among that week's attempts.
 */
async function weeklyTrend(courseIds, roster, now) {
  const start = new Date(weekStart(now).getTime() - (TREND_WEEKS - 1) * 7 * DAY_MS);
  const graded = new Set((await Assessment.find({
    course: { $in: courseIds }, isPractice: { $ne: true }, status: { $in: ['published', 'closed'] }
  }).distinct('_id')).map(String));
  const rows = await Submission.find({
    course: { $in: courseIds }, status: { $in: FINISHED }, isPractice: { $ne: true }, submittedAt: { $gte: start }
  }).select('student assessment course score maxScore submittedAt').lean();

  const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => ({
    week: new Date(start.getTime() + i * 7 * DAY_MS).toISOString().slice(0, 10), submissions: 0, best: new Map()
  }));
  const weekBy = new Map(weeks.map((w) => [w.week, w]));
  rows.forEach((s) => {
    const w = weekBy.get(weekStart(s.submittedAt).toISOString().slice(0, 10));
    if (!w) return;
    w.submissions += 1;
    if (!graded.has(String(s.assessment)) || !roster.pairs.has(`${s.student}:${s.course}`)) return;
    const key = `${s.student}:${s.assessment}`;
    w.best.set(key, Math.max(w.best.get(key) ?? -1, percentOf(s)));
  });
  return weeks.map((w) => ({ week: w.week, submissions: w.submissions, averageScore: averagePercent([...w.best.values()]) }));
}

/** Staff dashboard across every course the caller manages. */
async function overview(courseFilter, now = new Date()) {
  const courses = await Course.find({ ...courseFilter, archived: false }).select('title').lean();
  const courseIds = courses.map((c) => c._id);
  const titleBy = new Map(courses.map((c) => [String(c._id), c.title]));
  const roster = await activeRoster(courseIds);

  const [best, assessmentCount, submissions30d, trend, atRisk, upcoming, recent] = await Promise.all([
    bestAttempts({ courseIds }),
    Assessment.countDocuments({ course: { $in: courseIds }, isPractice: { $ne: true }, status: { $ne: 'archived' } }),
    Submission.countDocuments({
      course: { $in: courseIds }, status: { $in: FINISHED }, isPractice: { $ne: true },
      submittedAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) }
    }),
    weeklyTrend(courseIds, roster, now),
    atRiskStudents(courseIds, titleBy, now),
    Assessment.find({
      course: { $in: courseIds },
      isPractice: { $ne: true },
      status: 'published',
      dueDate: { $gte: now, $lte: new Date(now.getTime() + 14 * DAY_MS) }
    }).select('title course dueDate').sort({ dueDate: 1 }).limit(20).lean(),
    Submission.find({ course: { $in: courseIds }, status: { $in: FINISHED }, isPractice: { $ne: true } })
      .select('student assessment course percentage isPassed status submittedAt needsReview')
      .sort({ submittedAt: -1 }).limit(10)
      .populate('student', 'name').populate('assessment', 'title')
      .lean()
  ]);

  // Students (current roster) who finished each upcoming assessment.
  const finishedRows = await Submission.find({ assessment: { $in: upcoming.map((a) => a._id) }, status: { $in: FINISHED } })
    .select('assessment student course').lean();
  const submittedBy = new Map();
  finishedRows.filter((s) => roster.pairs.has(`${s.student}:${s.course}`)).forEach((s) => {
    const set = submittedBy.get(String(s.assessment)) || new Set();
    set.add(String(s.student));
    submittedBy.set(String(s.assessment), set);
  });
  // Class figures: each student's course average (mean of their best graded attempts), then the mean of those.
  const { averageScore, passRate } = summarizeStandings(await courseStandings(best));

  return {
    totals: { courses: courses.length, students: roster.students.size, assessments: assessmentCount, submissions30d },
    averageScore,
    passRate,
    trend,
    atRiskStudents: atRisk.slice(0, 20),
    upcomingDeadlines: upcoming.map((a) => ({
      id: String(a._id),
      title: a.title,
      courseId: String(a.course),
      courseTitle: titleBy.get(String(a.course)) || '',
      dueDate: a.dueDate,
      submitted: (submittedBy.get(String(a._id)) || new Set()).size,
      enrolled: (roster.byCourse.get(String(a.course)) || []).length
    })),
    recentSubmissions: recent.map((r) => ({
      id: String(r._id),
      student: r.student ? { id: String(r.student._id), name: r.student.name } : null,
      assessment: r.assessment ? { id: String(r.assessment._id), title: r.assessment.title } : null,
      courseId: String(r.course),
      courseTitle: titleBy.get(String(r.course)) || '',
      percentage: r.percentage,
      isPassed: r.isPassed,
      status: r.status,
      needsReview: !!r.needsReview,
      submittedAt: r.submittedAt
    }))
  };
}

/** Course analytics: summary, topic mastery heatmap, per-assessment summaries, score distribution, at-risk list. */
async function courseAnalytics(course) {
  const [assessments, roster, best] = await Promise.all([
    Assessment.find({ course: course._id, isPractice: { $ne: true }, status: { $in: ['published', 'closed'] } })
      .select('title status dueDate totalPoints passingScore questions.id questions.topic')
      .sort({ dueDate: 1, createdAt: 1 }).lean(),
    activeRoster([course._id]),
    bestAttempts({ courseIds: [course._id], project: { questionResults: 1 } })
  ]);
  const studentIds = roster.byCourse.get(String(course._id)) || [];
  const users = await User.find({ _id: { $in: studentIds } }).select('name').lean();

  // Topic display names: course topics first, then any other (canonicalised) question topic.
  const canonical = (t) => canonicalTopic(t, course.topics);
  const names = new Map();
  [...(course.topics || []), ...assessments.flatMap((a) => a.questions.map((q) => canonical(q.topic)))]
    .filter((t) => String(t || '').trim())
    .forEach((t) => { if (!names.has(topicKey(t))) names.set(topicKey(t), String(t).trim()); });
  const topicOf = new Map();
  assessments.forEach((a) => a.questions.forEach((q) => topicOf.set(`${a._id}:${q.id}`, topicKey(canonical(q.topic)))));

  const perStudent = new Map(); // studentId -> Map(topicKey -> { e, p })
  best.forEach((s) => {
    const m = perStudent.get(String(s.student)) || new Map();
    (s.questionResults || []).forEach((r) => {
      const key = topicOf.get(`${s.assessment}:${r.questionId}`);
      if (!key) return;
      const t = m.get(key) || { e: 0, p: 0 };
      t.e += r.pointsEarned || 0;
      t.p += r.maxPoints || 0;
      m.set(key, t);
    });
    perStudent.set(String(s.student), m);
  });
  const topicKeys = [...names.keys()];
  const students = users.map((u) => {
    const m = perStudent.get(String(u._id)) || new Map();
    const mastery = {};
    topicKeys.forEach((k) => {
      const t = m.get(k);
      mastery[names.get(k)] = t && t.p > 0 ? round1((t.e / t.p) * 100) : null;
    });
    return { id: String(u._id), name: u.name, mastery };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const byAssessment = new Map();
  best.forEach((s) => {
    const list = byAssessment.get(String(s.assessment)) || [];
    list.push(s);
    byAssessment.set(String(s.assessment), list);
  });
  const assessmentSummaries = assessments.map((a) => {
    const list = byAssessment.get(String(a._id)) || [];
    return {
      id: String(a._id),
      title: a.title,
      status: a.status,
      dueDate: a.dueDate || null,
      submissions: list.length,
      enrolled: studentIds.length,
      ...classSummary(list)
    };
  });

  return {
    summary: { students: studentIds.length, ...summarizeStandings(await courseStandings(best)) },
    topicMastery: { topics: topicKeys.map((k) => names.get(k)), students },
    assessmentSummaries,
    scoreDistribution: scoreDistribution(best.map((s) => s.pct)),
    atRiskStudents: await atRiskStudents([course._id], new Map([[String(course._id), course.title]]))
  };
}

/** Single assessment analytics: summary, distribution, item analysis and integrity. */
async function assessmentAnalytics(assessment, course) {
  const [best, finished] = await Promise.all([
    bestAttempts({
      courseIds: [assessment.course],
      assessmentIds: [assessment._id],
      anyStatus: true,
      project: { questionResults: 1, timeSpent: 1 }
    }),
    Submission.find({ assessment: assessment._id, status: { $in: FINISHED } }).select('integrity.violationCount integrity.terminated').lean()
  ]);
  const flagged = finished.filter((s) => s.integrity && (s.integrity.violationCount > 0 || s.integrity.terminated));
  return {
    summary: {
      submissions: best.length,
      attempts: finished.length,
      ...classSummary(best),
      averageTime: best.length ? Math.round(mean(best.map((s) => s.timeSpent || 0))) : null
    },
    distribution: scoreDistribution(best.map((s) => s.pct)),
    items: itemAnalysis(assessment.questions, best, (course && course.topics) || []),
    // Integrity is reported per attempt (every finished attempt, not only the best).
    integrity: {
      flagged: flagged.length,
      terminated: finished.filter((s) => s.integrity && s.integrity.terminated).length,
      averageViolations: finished.length
        ? round2(mean(finished.map((s) => (s.integrity && s.integrity.violationCount) || 0)))
        : null
    }
  };
}

/** Consecutive days (ending today, or yesterday if nothing yet today) with at least one finished attempt. */
function streakDays(dates, now = new Date()) {
  const days = new Set(dates.filter(Boolean).map((d) => new Date(d).toISOString().slice(0, 10)));
  let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

/** Student dashboard: progress per course, topic mastery, recent results, streak, upcoming work. */
async function studentAnalytics(orgId, studentId, now = new Date()) {
  const enrollments = await Enrollment.find({ organization: orgId, student: studentId, status: 'active' }).select('course').lean();
  const courseIds = enrollments.map((e) => e.course);
  const [courses, assessments, all] = await Promise.all([
    Course.find({ _id: { $in: courseIds }, archived: false }).select('title color topics').lean(),
    Assessment.find({
      course: { $in: courseIds },
      status: { $in: ['published', 'closed'] },
      $or: [{ isPractice: { $ne: true } }, { practiceFor: studentId }]
    }).select('title course status availableFrom dueDate maxAttempts isPractice resultsPolicy resultsReleased questions.id questions.topic')
      .lean(),
    Submission.find({ organization: orgId, student: studentId })
      .select('assessment course attempt percentage score maxScore questionResults submittedAt status isPractice deadlineAt')
      .lean()
  ]);
  const finished = all.filter((s) => FINISHED.includes(s.status));
  const assessmentBy = new Map(assessments.map((a) => [String(a._id), a]));
  const courseBy = new Map(courses.map((c) => [String(c._id), c]));
  const visible = (a) => a && attempts.resultsVisible(a, now);
  const best = bestByAssessment(finished);

  const courseRows = courses.map((c) => {
    const list = assessments.filter((a) => String(a.course) === String(c._id) && !a.isPractice);
    const done = list.filter((a) => best.has(String(a._id)));
    const scored = done.filter(visible).map((a) => percentOf(best.get(String(a._id))));
    return {
      id: String(c._id),
      title: c.title,
      color: c.color,
      completed: done.length,
      total: list.length,
      averageScore: averagePercent(scored)
    };
  });

  const topics = new Map(); // key -> { name, e, p }
  best.forEach((s, key) => {
    const a = assessmentBy.get(key);
    if (!a || a.isPractice || !visible(a)) return;
    const course = courseBy.get(String(a.course));
    const topicOf = new Map(a.questions.map((q) => [q.id, canonicalTopic(q.topic, course ? course.topics : [])]));
    s.questionResults.forEach((r) => {
      const name = topicOf.get(r.questionId);
      if (!name) return;
      const t = topics.get(topicKey(name)) || { name, e: 0, p: 0 };
      t.e += r.pointsEarned || 0;
      t.p += r.maxPoints || 0;
      topics.set(topicKey(name), t);
    });
  });
  const topicMastery = {};
  topics.forEach((t) => { if (t.p > 0) topicMastery[t.name] = round1((t.e / t.p) * 100); });

  const recent = [...finished].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 5).map((s) => {
    const a = assessmentBy.get(String(s.assessment));
    const c = courseBy.get(String(s.course));
    const released = visible(a);
    return {
      id: String(s._id),
      assessment: { id: String(s.assessment), title: a ? a.title : 'Assessment' },
      course: { id: String(s.course), title: c ? c.title : '' },
      isPractice: !!s.isPractice,
      status: s.status,
      released: !!released,
      percentage: released ? s.percentage : null,
      submittedAt: s.submittedAt
    };
  });

  // Work the student can still start or resume (attempts left or in progress, open, not past due); no due date sorts last.
  const upcoming = assessments
    .filter((a) => !a.isPractice && a.status === 'published' && courseBy.has(String(a.course)))
    .map((a) => ({ a, status: attempts.computeMyStatus(a, all.filter((s) => String(s.assessment) === String(a._id)), now) }))
    .filter(({ status }) => status.canStart)
    .sort((x, y) => (x.a.dueDate ? x.a.dueDate.getTime() : Infinity) - (y.a.dueDate ? y.a.dueDate.getTime() : Infinity))
    .slice(0, 20)
    .map(({ a, status }) => ({
      id: String(a._id),
      title: a.title,
      courseId: String(a.course),
      courseTitle: courseBy.get(String(a.course)).title,
      dueDate: a.dueDate || null,
      attempts: status.attempts,
      attemptsRemaining: status.attemptsRemaining,
      inProgress: status.inProgress
    }));

  return {
    courses: courseRows,
    topicMastery,
    recent,
    upcoming,
    streakDays: streakDays(finished.map((s) => s.submittedAt), now)
  };
}

module.exports = {
  scoreDistribution,
  itemAnalysis,
  median,
  streakDays,
  classSummary,
  atRiskStudents,
  overview,
  courseAnalytics,
  assessmentAnalytics,
  studentAnalytics
};
