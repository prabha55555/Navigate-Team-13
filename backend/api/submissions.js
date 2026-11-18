/**
 * Submissions: autosave, integrity events, submit, result views and manual
 * grading. See docs/ARCHITECTURE.md §5 "Submissions".
 */
const express = require('express');
const Assessment = require('../models/Assessment');
const Course = require('../models/Course');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { requireAuth, requireRole, STAFF_ROLES } = require('../middlewares/auth');
const { asyncHandler, badRequest, conflict, notFound } = require('../utils/errors');
const { pagination } = require('../utils/validate');
const access = require('../services/access');
const attempts = require('../services/attemptService');
const { notify } = require('../services/notify');
const { audit } = require('../services/audit');

const router = express.Router();
router.use(requireAuth);

/** Loads a submission the caller owns (students acting on their own attempt) plus its assessment. */
async function loadOwnAttempt(req) {
  const { submission, isOwner } = await access.loadSubmissionForViewer(req, req.params.id);
  if (!isOwner) throw notFound('Submission not found');
  const assessment = await Assessment.findById(submission.assessment);
  if (!assessment) throw notFound('Assessment not found');
  return { submission, assessment };
}

async function resultFor(req, submission, assessment, forStaff) {
  const [course, student] = await Promise.all([
    Course.findById(submission.course).select('title topics').lean(),
    forStaff ? User.findById(submission.student).select('name email').lean() : null
  ]);
  return attempts.submissionView(submission, assessment, { forStaff, course, student });
}

router.get('/mine', requireRole('student'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pagination(req.query);
  const filter = { organization: req.user.organization, student: req.user.id, status: { $ne: 'in-progress' } };
  if (req.query.courseId) filter.course = req.query.courseId;
  if (req.query.practice === 'true') filter.isPractice = true;
  else if (req.query.practice === 'false') filter.isPractice = { $ne: true };
  const [rows, total] = await Promise.all([
    Submission.find(filter)
      .select('assessment course attempt status submittedAt timeSpent percentage score maxScore isPassed isPractice')
      .sort({ submittedAt: -1 }).skip(skip).limit(pageSize).lean(),
    Submission.countDocuments(filter)
  ]);
  const [assessments, courses] = await Promise.all([
    Assessment.find({ _id: { $in: rows.map((r) => r.assessment) } })
      .select('title resultsPolicy resultsReleased dueDate passingScore').lean(),
    Course.find({ _id: { $in: rows.map((r) => r.course) } }).select('title color').lean()
  ]);
  const assessmentBy = new Map(assessments.map((a) => [String(a._id), a]));
  const courseBy = new Map(courses.map((c) => [String(c._id), c]));
  const items = rows.map((s) => {
    const a = assessmentBy.get(String(s.assessment)) || {};
    const c = courseBy.get(String(s.course)) || {};
    const released = attempts.resultsVisible(a);
    return {
      id: String(s._id),
      assessment: { id: String(s.assessment), title: a.title || 'Assessment' },
      course: { id: String(s.course), title: c.title || '', color: c.color },
      attempt: s.attempt,
      status: s.status,
      isPractice: !!s.isPractice,
      submittedAt: s.submittedAt,
      timeSpent: s.timeSpent,
      released,
      score: released ? s.score : null,
      maxScore: released ? s.maxScore : null,
      percentage: released ? s.percentage : null,
      isPassed: released ? s.isPassed : null
    };
  });
  res.json({ items, total, page, pageSize });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { submission, isOwner } = await access.loadSubmissionForViewer(req, req.params.id);
  const assessment = await Assessment.findById(submission.assessment);
  if (!assessment) throw notFound('Assessment not found');
  let current = submission;
  if (await attempts.finalizeIfExpired(submission, assessment)) current = await Submission.findById(submission._id);
  res.json(await resultFor(req, current, assessment, !isOwner));
}));

router.patch('/:id/answers', requireRole('student'), asyncHandler(async (req, res) => {
  const { submission, assessment } = await loadOwnAttempt(req);
  const answers = req.body && req.body.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw badRequest('answers must be an object keyed by question id', { field: 'answers' });
  }
  res.json(await attempts.saveAnswers(submission, assessment, answers));
}));

router.post('/:id/events', requireRole('student'), asyncHandler(async (req, res) => {
  const { submission, assessment } = await loadOwnAttempt(req);
  const { type, detail } = req.body || {};
  if (!type) throw badRequest('type is required', { field: 'type' });
  res.json(await attempts.recordEvent(submission, assessment, { type, detail }));
}));

router.post('/:id/submit', requireRole('student'), asyncHandler(async (req, res) => {
  const { submission, assessment } = await loadOwnAttempt(req);
  if (submission.status !== 'in-progress') throw conflict('This attempt has already been submitted');
  const result = await attempts.finalize(submission, assessment, { answers: req.body && req.body.answers });
  const view = await resultFor(req, result.submission, assessment, false);
  res.json({ ...view, lateAnswersRejected: result.lateAnswersRejected });
}));

router.patch('/:id/grade', requireRole(...STAFF_ROLES), asyncHandler(async (req, res) => {
  const { submission } = await access.loadSubmissionForViewer(req, req.params.id);
  if (submission.status === 'in-progress') throw conflict('This attempt has not been submitted yet');
  const assessment = await Assessment.findById(submission.assessment);
  if (!assessment) throw notFound('Assessment not found');
  const { questionScores, overrideScore, comment } = req.body || {};

  if (questionScores !== undefined) {
    if (!questionScores || typeof questionScores !== 'object' || Array.isArray(questionScores)) {
      throw badRequest('questionScores must be an object keyed by question id', { field: 'questionScores' });
    }
    Object.entries(questionScores).forEach(([qid, value]) => {
      const result = submission.questionResults.find((r) => r.questionId === qid);
      const points = Number(value);
      if (!result) throw badRequest(`Unknown question "${qid}"`, { field: 'questionScores' });
      if (!Number.isFinite(points) || points < 0 || points > result.maxPoints) {
        throw badRequest(`Points for "${qid}" must be between 0 and ${result.maxPoints}`, { field: 'questionScores' });
      }
      result.pointsEarned = points;
      result.isCorrect = points === result.maxPoints;
      result.needsReview = false;
    });
  }
  if (overrideScore !== undefined) {
    if (overrideScore === null) submission.override = undefined;
    else {
      const score = Number(overrideScore);
      if (!Number.isFinite(score) || score < 0 || score > (submission.maxScore || 0)) {
        throw badRequest(`overrideScore must be between 0 and ${submission.maxScore || 0}`, { field: 'overrideScore' });
      }
      submission.override = { score, comment: '', by: req.user.id, at: new Date() };
    }
  }
  if (comment !== undefined) {
    const text = String(comment || '').slice(0, 2000);
    const current = submission.override || {};
    submission.override = { score: current.score, comment: text, by: req.user.id, at: new Date() };
  }
  if (questionScores === undefined && overrideScore === undefined && comment === undefined) {
    throw badRequest('Nothing to update: send questionScores, overrideScore or comment');
  }

  const course = await Course.findById(submission.course).select('topics').lean();
  attempts.recomputeTotals(submission, assessment, course ? course.topics : []);
  await submission.save();
  await audit(req, 'submission.grade', {
    targetType: 'Submission',
    targetId: submission._id,
    meta: { score: submission.score, maxScore: submission.maxScore, override: overrideScore !== undefined }
  });
  await notify(submission.student, {
    type: 'submission.graded',
    title: `Grade updated: ${assessment.title}`,
    body: 'Your instructor reviewed your submission.',
    link: `/app/results/${submission._id}`
  }, req.user.organization);
  res.json(await resultFor(req, submission, assessment, true));
}));

module.exports = router;
