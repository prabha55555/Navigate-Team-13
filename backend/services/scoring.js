/**
 * The single scoring basis for every class / assessment / student average and
 * pass rate shown anywhere (analytics, course list, roster, gradebook, at-risk):
 *
 *   one data point per student per assessment = that student's BEST graded
 *   attempt (the official grade), counting only finished ('submitted' /
 *   'terminated') attempts at published or closed, non-practice assessments,
 *   and only students currently on the roster (active enrollment, account not
 *   deactivated).
 *
 * Averages are computed from unrounded percentages and rounded once, half up,
 * to one decimal.
 */
const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const Enrollment = require('../models/Enrollment');
const Submission = require('../models/Submission');
const User = require('../models/User');

const FINISHED = ['submitted', 'terminated'];
const GRADED_STATUSES = ['published', 'closed'];

/** Rounds half up to `digits` decimals, immune to binary float noise (46.65 → 46.7). */
function roundHalfUp(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  const shifted = Number((Number(value) * factor).toPrecision(15));
  return (Math.sign(shifted) * Math.round(Math.abs(shifted))) / factor || 0;
}

/** Unrounded percentage of a submission (score already includes any manual override). */
const percentOf = (s) => (s && s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0);

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Mean of unrounded percentages, rounded once. */
const averagePercent = (xs) => roundHalfUp(mean(xs));

const toIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));

/** Ids of deactivated users in a workspace (excluded from rosters, counts and notifications). */
async function deactivatedUserIds(orgId) {
  return User.find({ organization: orgId, deactivated: true }).distinct('_id');
}

/**
 * Current roster of the given courses: active enrollments of non-deactivated students.
 * @returns {Promise<{ pairs: Set<string>, byCourse: Map<string, string[]>, students: Set<string> }>}
 *          pairs are "studentId:courseId"
 */
async function activeRoster(courseIds) {
  const enrollments = await Enrollment.find({ course: { $in: courseIds }, status: 'active' })
    .select('course student organization').lean();
  const orgIds = [...new Set(enrollments.map((e) => String(e.organization)))];
  const inactive = new Set((await Promise.all(orgIds.map(deactivatedUserIds))).flat().map(String));
  const pairs = new Set();
  const byCourse = new Map();
  const students = new Set();
  enrollments.filter((e) => !inactive.has(String(e.student))).forEach((e) => {
    pairs.add(`${e.student}:${e.course}`);
    students.add(String(e.student));
    const list = byCourse.get(String(e.course)) || [];
    list.push(String(e.student));
    byCourse.set(String(e.course), list);
  });
  return { pairs, byCourse, students };
}

/**
 * Best graded attempt per (student, assessment), on the official basis above.
 * @param {object} opts
 * @param {Array} opts.courseIds courses to include
 * @param {Array} [opts.assessmentIds] restrict to these assessments
 * @param {object} [opts.project] extra Submission fields to return (e.g. { questionResults: 1 })
 * @param {boolean} [opts.rosterOnly=true] keep only students currently on the roster
 * @param {boolean} [opts.anyStatus=false] with `assessmentIds`, also include draft/archived assessments
 * @returns {Promise<object[]>} lean submissions with `pct` (unrounded percentage)
 */
async function bestAttempts({ courseIds, assessmentIds, project = {}, rosterOnly = true, anyStatus = false }) {
  if (!courseIds.length) return [];
  const assessmentFilter = { course: { $in: courseIds }, isPractice: { $ne: true }, status: { $in: GRADED_STATUSES } };
  if (assessmentIds) {
    assessmentFilter._id = { $in: assessmentIds };
    if (anyStatus) delete assessmentFilter.status;
  }
  const graded = await Assessment.find(assessmentFilter).distinct('_id');
  if (!graded.length) return [];
  const [docs, roster] = await Promise.all([
    Submission.aggregate([
      { $match: { assessment: { $in: toIds(graded) }, status: { $in: FINISHED } } },
      {
        $project: {
          student: 1, assessment: 1, course: 1, attempt: 1, score: 1, maxScore: 1, isPassed: 1, submittedAt: 1, ...project,
          pct: { $cond: [{ $gt: ['$maxScore', 0] }, { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] }, 0] }
        }
      },
      { $sort: { pct: -1, submittedAt: -1 } },
      { $group: { _id: { s: '$student', a: '$assessment' }, doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } }
    ]),
    rosterOnly ? activeRoster(courseIds) : null
  ]);
  return roster ? docs.filter((d) => roster.pairs.has(`${d.student}:${d.course}`)) : docs;
}

/**
 * Course standing per (student, course) from best-attempt documents: the
 * student's average over their best graded attempts in that course, and
 * whether it reaches the average pass mark of those assessments.
 * @returns {Promise<{ student, course, average, passed, graded }[]>}
 */
async function courseStandings(best) {
  const assessmentIds = [...new Set(best.map((d) => String(d.assessment)))];
  const passing = new Map((await Assessment.find({ _id: { $in: assessmentIds } }).select('passingScore').lean())
    .map((a) => [String(a._id), typeof a.passingScore === 'number' ? a.passingScore : 50]));
  const groups = new Map();
  best.forEach((d) => {
    const key = `${d.student}:${d.course}`;
    const g = groups.get(key) || { student: String(d.student), course: String(d.course), pcts: [], marks: [] };
    g.pcts.push(d.pct);
    g.marks.push(passing.get(String(d.assessment)) ?? 50);
    groups.set(key, g);
  });
  return [...groups.values()].map((g) => ({
    student: g.student,
    course: g.course,
    average: mean(g.pcts),
    passed: mean(g.pcts) >= mean(g.marks),
    graded: g.pcts.length
  }));
}

/** Class figures from course standings: mean of student averages, share of students passing. */
function summarizeStandings(standings) {
  return {
    averageScore: averagePercent(standings.map((s) => s.average)),
    passRate: standings.length ? roundHalfUp((standings.filter((s) => s.passed).length / standings.length) * 100) : null,
    gradedStudents: standings.length
  };
}

/** JS equivalent for an in-memory list of one student's submissions: best finished attempt per assessment. */
function bestByAssessment(submissions) {
  const best = new Map();
  submissions.filter((s) => FINISHED.includes(s.status)).forEach((s) => {
    const key = String(s.assessment);
    const current = best.get(key);
    if (!current || percentOf(s) > percentOf(current)) best.set(key, s);
  });
  return best;
}

module.exports = {
  FINISHED,
  GRADED_STATUSES,
  roundHalfUp,
  percentOf,
  mean,
  averagePercent,
  deactivatedUserIds,
  activeRoster,
  bestAttempts,
  bestByAssessment,
  courseStandings,
  summarizeStandings
};
