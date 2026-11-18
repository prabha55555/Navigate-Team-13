/**
 * Assessments: authoring (staff), listing, and starting attempts (students).
 * See docs/ARCHITECTURE.md §5 "Assessments".
 */
const express = require('express');
const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const Course = require('../models/Course');
const { requireAuth, requireRole, STAFF_ROLES } = require('../middlewares/auth');
const { asyncHandler, badRequest, conflict, notFound } = require('../utils/errors');
const { pagination, escapeRegex } = require('../utils/validate');
const { serialize } = require('../utils/serialize');
const access = require('../services/access');
const attempts = require('../services/attemptService');
const { cleanQuestions, hasValidKey } = require('../services/questions');
const { notify } = require('../services/notify');
const scoring = require('../services/scoring');
const { audit } = require('../services/audit');

const router = express.Router();
router.use(requireAuth);
const staffOnly = requireRole(...STAFF_ROLES);

const RESULTS_POLICIES = ['immediate', 'after-due', 'manual'];
const STATUSES = ['draft', 'published', 'closed', 'archived'];

function parseDate(value, field) {
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} must be a valid date`, { field });
  return date;
}

function parseNumber(value, field, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${field} must be between ${min} and ${max}`, { field });
  return n;
}

/** Applies the editable settings in `body` to `target` (questions handled separately). */
function applySettings(target, body) {
  const text = (field, max) => {
    if (body[field] === undefined) return;
    if (field === 'title' && !String(body.title || '').trim()) throw badRequest('title is required', { field: 'title' });
    target[field] = String(body[field] || '').trim().slice(0, max);
  };
  text('title', 200);
  text('description', 5000);
  text('instructions', 5000);
  if (body.availableFrom !== undefined) target.availableFrom = parseDate(body.availableFrom, 'availableFrom');
  if (body.dueDate !== undefined) target.dueDate = parseDate(body.dueDate, 'dueDate');
  if (body.timeLimit !== undefined) target.timeLimit = Math.round(parseNumber(body.timeLimit, 'timeLimit', 0, 1440));
  if (body.maxAttempts !== undefined) target.maxAttempts = Math.round(parseNumber(body.maxAttempts, 'maxAttempts', 1, 100));
  if (body.passingScore !== undefined) target.passingScore = parseNumber(body.passingScore, 'passingScore', 0, 100);
  ['shuffleQuestions', 'shuffleOptions', 'showCorrectAnswers'].forEach((f) => {
    if (body[f] !== undefined) target[f] = !!body[f];
  });
  if (body.resultsPolicy !== undefined) {
    if (!RESULTS_POLICIES.includes(body.resultsPolicy)) {
      throw badRequest(`resultsPolicy must be one of: ${RESULTS_POLICIES.join(', ')}`, { field: 'resultsPolicy' });
    }
    target.resultsPolicy = body.resultsPolicy;
  }
  if (body.proctoring && typeof body.proctoring === 'object') {
    const p = body.proctoring;
    const current = target.proctoring || {};
    target.proctoring = {
      enabled: p.enabled !== undefined ? !!p.enabled : !!current.enabled,
      fullscreen: p.fullscreen !== undefined ? !!p.fullscreen : !!current.fullscreen,
      webcam: p.webcam !== undefined ? !!p.webcam : !!current.webcam,
      blockShortcuts: p.blockShortcuts !== undefined ? !!p.blockShortcuts : !!current.blockShortcuts,
      maxViolations: p.maxViolations !== undefined
        ? Math.round(parseNumber(p.maxViolations, 'proctoring.maxViolations', 1, 100))
        : (current.maxViolations || 5)
    };
  }
  if (body.source !== undefined && ['manual', 'ai-syllabus', 'ai-quick', 'bank'].includes(body.source)) {
    target.source = body.source;
  }
  if (target.availableFrom && target.dueDate && target.availableFrom >= target.dueDate) {
    throw badRequest('dueDate must be after availableFrom', { field: 'dueDate' });
  }
}

/** Throws 400 with the list of problems when the assessment cannot be published. */
function assertPublishable(assessment) {
  const problems = [];
  if (!assessment.questions.length) problems.push('Add at least one question');
  assessment.questions.forEach((q, i) => {
    if (!hasValidKey(q)) problems.push(`Question ${i + 1} needs a correct answer`);
  });
  if (problems.length) throw badRequest('This assessment cannot be published yet', { problems });
}

/** Students currently on the course roster (active enrollment, account not deactivated). */
async function activeStudentIds(courseId) {
  const roster = await scoring.activeRoster([courseId]);
  return roster.byCourse.get(String(courseId)) || [];
}

async function publish(req, assessment, course) {
  assertPublishable(assessment);
  const wasPublished = assessment.status === 'published';
  // publishedAt is the FIRST publication: re-publishing after unpublish/close does not announce it again.
  const firstPublish = !assessment.publishedAt;
  assessment.status = 'published';
  if (firstPublish) assessment.publishedAt = new Date();
  await assessment.save();
  if (!wasPublished) await audit(req, 'assessment.publish', { targetType: 'Assessment', targetId: assessment._id });
  if (firstPublish) {
    await notify(await activeStudentIds(course._id), {
      type: 'assessment.published',
      title: `New assessment: ${assessment.title}`,
      body: assessment.dueDate
        ? `${course.title} · due ${assessment.dueDate.toISOString().slice(0, 10)}`
        : course.title,
      link: `/app/take/${assessment._id}`
    }, req.user.organization);
  }
}

/** Staff view: everything incl. questions and keys, plus course title and submission count. */
async function staffView(assessment, course) {
  const submissionCount = await Submission.countDocuments({ assessment: assessment._id, status: { $ne: 'in-progress' } });
  return {
    ...assessment.toJSON(),
    courseId: String(assessment.course),
    courseTitle: course.title,
    questionCount: assessment.questions.length,
    submissionCount
  };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

router.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pagination(req.query);
  const filter = { organization: req.user.organization };
  if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');

  if (access.isStaff(req)) {
    if (req.query.courseId) filter.course = (await access.loadCourseForStaff(req, req.query.courseId))._id;
    else filter.course = { $in: await access.staffCourseIds(req) };
    filter.isPractice = { $ne: true };
    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        throw badRequest(`status must be one of: ${STATUSES.join(', ')}`, { field: 'status' });
      }
      filter.status = req.query.status;
    } else if (req.query.includeArchived !== 'true') filter.status = { $ne: 'archived' };

    const [rows, total] = await Promise.all([
      Assessment.find(filter).select('-questions.correctAnswer -questions.explanation')
        .sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      Assessment.countDocuments(filter)
    ]);
    const ids = rows.map((a) => a._id);
    const [counts, courses] = await Promise.all([
      Submission.aggregate([
        { $match: { assessment: { $in: ids }, status: { $ne: 'in-progress' } } },
        { $group: { _id: '$assessment', n: { $sum: 1 } } }
      ]),
      Course.find({ _id: { $in: rows.map((a) => a.course) } }).select('title').lean()
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c]));
    // Average on the official basis: best graded attempt per student (current roster).
    const best = await scoring.bestAttempts({ courseIds: [...new Set(rows.map((a) => String(a.course)))], assessmentIds: ids, anyStatus: true });
    const pctsBy = new Map();
    best.forEach((d) => {
      const list = pctsBy.get(String(d.assessment)) || [];
      list.push(d.pct);
      pctsBy.set(String(d.assessment), list);
    });
    const titleBy = new Map(courses.map((c) => [String(c._id), c.title]));
    const items = rows.map((a) => {
      const { questions, ...rest } = serialize(a);
      const stats = countBy.get(String(a._id));
      return {
        ...rest,
        courseId: String(a.course),
        courseTitle: titleBy.get(String(a.course)) || '',
        questionCount: questions.length,
        submissionCount: stats ? stats.n : 0,
        averageScore: scoring.averagePercent(pctsBy.get(String(a._id)) || [])
      };
    });
    return res.json({ items, total, page, pageSize });
  }

  // Students: published/closed assessments in enrolled courses, plus their own practice quizzes.
  const enrolled = await access.enrolledCourseIds(req);
  if (req.query.courseId) {
    if (!enrolled.some((id) => String(id) === String(req.query.courseId))) throw notFound('Course not found');
    filter.course = req.query.courseId;
  } else filter.course = { $in: enrolled };
  filter.status = req.query.status && ['published', 'closed'].includes(req.query.status)
    ? req.query.status
    : { $in: ['published', 'closed'] };
  filter.$or = [{ isPractice: { $ne: true } }, { practiceFor: req.user.id }];
  if (req.query.practice === 'true') filter.isPractice = true;
  if (req.query.practice === 'false') filter.isPractice = { $ne: true };

  const [rows, total] = await Promise.all([
    Assessment.find(filter).select('-questions.correctAnswer -questions.explanation -questions.text -questions.options')
      .sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Assessment.countDocuments(filter)
  ]);
  const [mine, courses] = await Promise.all([
    Submission.find({ student: req.user.id, assessment: { $in: rows.map((a) => a._id) } })
      .select('assessment status percentage attempt deadlineAt').lean(),
    Course.find({ _id: { $in: rows.map((a) => a.course) } }).select('title color').lean()
  ]);
  const courseBy = new Map(courses.map((c) => [String(c._id), c]));
  const now = new Date();
  const items = rows.map((a) => {
    const course = courseBy.get(String(a.course));
    return {
      ...attempts.studentAssessmentSummary(a),
      courseTitle: course ? course.title : '',
      courseColor: course ? course.color : undefined,
      myStatus: attempts.computeMyStatus(a, mine.filter((s) => String(s.assessment) === String(a._id)), now)
    };
  });
  return res.json({ items, total, page, pageSize });
}));

// ---------------------------------------------------------------------------
// Authoring (staff)
// ---------------------------------------------------------------------------

router.post('/', staffOnly, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.courseId) throw badRequest('courseId is required', { field: 'courseId' });
  if (!String(body.title || '').trim()) throw badRequest('title is required', { field: 'title' });
  const course = await access.loadCourseForStaff(req, body.courseId);
  const assessment = new Assessment({
    organization: req.user.organization,
    course: course._id,
    createdBy: req.user.id,
    status: 'draft',
    questions: cleanQuestions(body.questions || [])
  });
  applySettings(assessment, body);
  await assessment.save();
  await audit(req, 'assessment.create', { targetType: 'Assessment', targetId: assessment._id, meta: { title: assessment.title } });
  if (body.status === 'published') await publish(req, assessment, course);
  res.status(201).json(await staffView(assessment, course));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (access.isStaff(req)) {
    const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
    return res.json(await staffView(assessment, course));
  }
  const { assessment, course } = await access.loadAssessmentForStudent(req, req.params.id);
  const mine = await Submission.find({ assessment: assessment._id, student: req.user.id })
    .select('status percentage attempt deadlineAt').lean();
  return res.json({
    ...attempts.studentAssessmentSummary(assessment),
    courseTitle: course.title,
    myStatus: attempts.computeMyStatus(assessment, mine)
  });
}));

router.patch('/:id', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  const body = req.body || {};
  if (body.questions !== undefined) {
    const incoming = cleanQuestions(body.questions);
    const hasSubmissions = await Submission.exists({ assessment: assessment._id });
    if (!hasSubmissions) assessment.questions = incoming;
    else if (req.query.force !== 'true' && body.force !== true) {
      throw conflict('Students have already started this assessment; questions can no longer be changed', { reason: 'has-submissions' });
    } else {
      // Forced edits after students started may only reword questions or explanations.
      const byId = new Map(incoming.map((q) => [q.id, q]));
      assessment.questions.forEach((q) => {
        const next = byId.get(q.id);
        if (!next) return;
        q.text = next.text;
        q.explanation = next.explanation;
      });
      assessment.markModified('questions');
    }
  }
  applySettings(assessment, body);
  if (assessment.status === 'published') assertPublishable(assessment);
  await assessment.save();
  await audit(req, 'assessment.update', { targetType: 'Assessment', targetId: assessment._id });
  res.json(await staffView(assessment, course));
}));

router.delete('/:id', staffOnly, asyncHandler(async (req, res) => {
  const { assessment } = await access.loadAssessmentForStaff(req, req.params.id);
  assessment.status = 'archived';
  await assessment.save();
  await audit(req, 'assessment.archive', { targetType: 'Assessment', targetId: assessment._id });
  res.json({ message: 'Assessment archived' });
}));

router.post('/:id/publish', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  await publish(req, assessment, course);
  res.json(await staffView(assessment, course));
}));

router.post('/:id/close', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  if (assessment.status !== 'published') throw conflict('Only a published assessment can be closed');
  assessment.status = 'closed';
  await assessment.save();
  await audit(req, 'assessment.close', { targetType: 'Assessment', targetId: assessment._id });
  res.json(await staffView(assessment, course));
}));

router.post('/:id/unpublish', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  if (assessment.status !== 'published') throw conflict('Only a published assessment can be unpublished');
  if (await Submission.exists({ assessment: assessment._id })) {
    throw conflict('Students have already started this assessment, so it can no longer be unpublished. Close it instead.', {
      reason: 'has-submissions'
    });
  }
  assessment.status = 'draft';
  await assessment.save();
  await audit(req, 'assessment.unpublish', { targetType: 'Assessment', targetId: assessment._id });
  res.json(await staffView(assessment, course));
}));

router.post('/:id/restore', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  if (assessment.status !== 'archived') throw conflict('Only an archived assessment can be restored');
  assessment.status = 'draft';
  await assessment.save();
  await audit(req, 'assessment.restore', { targetType: 'Assessment', targetId: assessment._id });
  res.json(await staffView(assessment, course));
}));

router.post('/:id/duplicate', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  const source = assessment.toObject();
  ['_id', 'createdAt', 'updatedAt', 'publishedAt', '__v'].forEach((k) => delete source[k]);
  const copy = await Assessment.create({
    ...source,
    title: `Copy of ${assessment.title}`.slice(0, 200),
    createdBy: req.user.id,
    status: 'draft',
    resultsReleased: false,
    isPractice: false,
    practiceFor: undefined,
    source: assessment.source === 'practice' ? 'manual' : assessment.source
  });
  await audit(req, 'assessment.duplicate', { targetType: 'Assessment', targetId: copy._id, meta: { from: String(assessment._id) } });
  res.status(201).json(await staffView(copy, course));
}));

router.post('/:id/release-results', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  const alreadyReleased = assessment.resultsReleased;
  assessment.resultsReleased = true;
  await assessment.save();
  if (!alreadyReleased) {
    const onRoster = new Set((await activeStudentIds(course._id)).map(String));
    const students = (await Submission.distinct('student', { assessment: assessment._id, status: { $ne: 'in-progress' } }))
      .filter((id) => onRoster.has(String(id)));
    await notify(students, {
      type: 'results.released',
      title: `Results available: ${assessment.title}`,
      body: `Your results for "${assessment.title}" (${course.title}) are ready.`,
      link: '/app/results'
    }, req.user.organization);
    await audit(req, 'assessment.release_results', { targetType: 'Assessment', targetId: assessment._id });
  }
  res.json(await staffView(assessment, course));
}));

router.get('/:id/submissions', staffOnly, asyncHandler(async (req, res) => {
  const { assessment } = await access.loadAssessmentForStaff(req, req.params.id);
  const filter = { assessment: assessment._id };
  if (req.query.status) filter.status = String(req.query.status);
  const rows = await Submission.find(filter)
    .select('student attempt status percentage score maxScore isPassed submittedAt startedAt timeSpent integrity.violationCount plagiarism.isPlagiarismDetected needsReview override.score')
    .populate('student', 'name email')
    .sort({ submittedAt: -1, startedAt: -1 })
    .lean();
  res.json({
    items: rows.map((s) => ({
      id: String(s._id),
      student: s.student ? { id: String(s.student._id), name: s.student.name, email: s.student.email } : null,
      attempt: s.attempt,
      status: s.status,
      score: s.score ?? null,
      maxScore: s.maxScore ?? null,
      percentage: s.percentage ?? null,
      isPassed: s.isPassed ?? null,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt || null,
      timeSpent: s.timeSpent,
      violationCount: (s.integrity && s.integrity.violationCount) || 0,
      plagiarismFlag: !!(s.plagiarism && s.plagiarism.isPlagiarismDetected),
      needsReview: !!s.needsReview,
      overridden: !!(s.override && typeof s.override.score === 'number')
    })),
    total: rows.length
  });
}));

// ---------------------------------------------------------------------------
// Attempts (students)
// ---------------------------------------------------------------------------

router.post('/:id/attempts', requireRole('student'), asyncHandler(async (req, res) => {
  const { assessment } = await access.loadAssessmentForStudent(req, req.params.id);
  const submission = await attempts.startAttempt(req, assessment);
  res.status(201).json(attempts.attemptView(assessment, submission));
}));

module.exports = router;
