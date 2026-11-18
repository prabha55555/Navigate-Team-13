/**
 * Courses, rosters, join codes and gradebooks. See docs/ARCHITECTURE.md §5 "Courses".
 */
const express = require('express');
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { requireAuth, requireRole, STAFF_ROLES, ADMIN_ROLES } = require('../middlewares/auth');
const { asyncHandler, badRequest, conflict, forbidden, notFound } = require('../utils/errors');
const { pagination, escapeRegex, normalizeEmail, isEmail } = require('../utils/validate');
const access = require('../services/access');
const attempts = require('../services/attemptService');
const gradebook = require('../services/gradebookService');
const scoring = require('../services/scoring');
const { audit } = require('../services/audit');

const router = express.Router();
router.use(requireAuth);
const staffOnly = requireRole(...STAFF_ROLES);

const COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

function cleanTopics(value) {
  if (!Array.isArray(value)) throw badRequest('topics must be a list', { field: 'topics' });
  return [...new Set(value.map((t) => String(t || '').trim().slice(0, 120)).filter(Boolean))].slice(0, 100);
}

/** Applies editable course fields from `body` onto the course document. */
async function applyCourseFields(course, body) {
  const text = (field, max) => {
    if (body[field] !== undefined) course[field] = String(body[field] || '').trim().slice(0, max);
  };
  if (body.title !== undefined && !String(body.title || '').trim()) throw badRequest('title is required', { field: 'title' });
  text('title', 200);
  text('code', 40);
  text('description', 5000);
  text('term', 80);
  if (body.color !== undefined) {
    if (!COLOR_PATTERN.test(String(body.color))) throw badRequest('color must be a hex color like #4f46e5', { field: 'color' });
    course.color = body.color;
  }
  if (body.topics !== undefined) course.topics = cleanTopics(body.topics);
  if (body.archived !== undefined) course.archived = !!body.archived;
  if (body.joinCodeEnabled !== undefined) course.joinCodeEnabled = !!body.joinCodeEnabled;
  if (body.outcomes !== undefined) {
    if (!Array.isArray(body.outcomes)) throw badRequest('outcomes must be a list', { field: 'outcomes' });
    course.outcomes = body.outcomes.slice(0, 100).map((o, i) => {
      if (!o || !String(o.description || '').trim()) {
        throw badRequest(`Outcome ${i + 1} needs a description`, { field: `outcomes.${i}.description` });
      }
      const outcome = {
        code: String(o.code || `LO${i + 1}`).trim().slice(0, 40),
        description: String(o.description).trim().slice(0, 1000),
        bloomLevel: String(o.bloomLevel || '').trim().slice(0, 40)
      };
      if (o.id && /^[\w-]{1,40}$/.test(String(o.id))) outcome.id = String(o.id);
      return outcome;
    });
  }
  if (body.curriculumMap !== undefined) {
    const links = body.curriculumMap && Array.isArray(body.curriculumMap.links) ? body.curriculumMap.links : null;
    if (!links) throw badRequest('curriculumMap.links must be a list', { field: 'curriculumMap' });
    const ids = links.map((l) => l && l.assessmentId).filter((id) => mongoose.isValidObjectId(id));
    const owned = new Set((await Assessment.find({ _id: { $in: ids }, course: course._id }).select('_id').lean())
      .map((a) => String(a._id)));
    course.curriculumMap = { links: [] };
    // Validated after outcomes so links can reference outcomes sent in the same request.
    course.$locals.pendingLinks = links.map((l, i) => {
      if (!l || !owned.has(String(l.assessmentId))) {
        throw badRequest(`Link ${i + 1} references an assessment outside this course`, { field: `curriculumMap.links.${i}` });
      }
      return { outcomeId: String(l.outcomeId || ''), assessmentId: l.assessmentId };
    });
  }
}

/** Resolves pending curriculum links against the (saved) outcome ids. */
function applyPendingLinks(course) {
  const links = course.$locals.pendingLinks;
  if (!links) return;
  const outcomeIds = new Set(course.outcomes.map((o) => o.id));
  links.forEach((l, i) => {
    if (!outcomeIds.has(l.outcomeId)) throw badRequest(`Link ${i + 1} references an unknown outcome`, { field: `curriculumMap.links.${i}` });
  });
  const unique = new Map(links.map((l) => [`${l.outcomeId}:${l.assessmentId}`, l]));
  course.curriculumMap = { links: [...unique.values()] };
  delete course.$locals.pendingLinks;
}

/** Course as returned to the caller; join code only for staff who manage it. */
async function courseView(req, course, extra = {}) {
  const instructors = await User.find({ _id: { $in: course.instructors } }).select('name email').lean();
  const view = {
    ...(typeof course.toJSON === 'function' ? course.toJSON() : course),
    instructors: instructors.map((u) => ({ id: String(u._id), name: u.name, email: u.email })),
    canManage: access.canManageCourse(req, course),
    ...extra
  };
  if (!view.canManage) {
    delete view.joinCode;
    delete view.joinCodeEnabled;
  }
  return view;
}

// ---------------------------------------------------------------------------
// List / create / read / update / archive
// ---------------------------------------------------------------------------

router.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pagination(req.query, { defaultSize: 50 });
  const filter = access.isStaff(req)
    ? access.staffCourseFilter(req)
    : { organization: req.user.organization, _id: { $in: await access.enrolledCourseIds(req) } };
  filter.archived = req.query.archived === 'true' && access.isStaff(req);
  if (req.query.q) {
    const q = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
    filter.$or = [{ title: q }, { code: q }];
  }
  const [courses, total] = await Promise.all([
    Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Course.countDocuments(filter)
  ]);
  const ids = courses.map((c) => c._id);
  const [roster, assessmentRows, instructors, best] = await Promise.all([
    scoring.activeRoster(ids),
    Assessment.find({ course: { $in: ids }, isPractice: { $ne: true }, status: { $in: ['published', 'closed', 'draft'] } })
      .select('course status resultsPolicy resultsReleased dueDate').lean(),
    User.find({ _id: { $in: courses.flatMap((c) => c.instructors) } }).select('name').lean(),
    access.isStaff(req) ? scoring.bestAttempts({ courseIds: ids }) : []
  ]);
  const instructorBy = new Map(instructors.map((u) => [String(u._id), u.name]));
  // Class average per course on the official basis (same figure as the course analytics summary).
  const standings = await scoring.courseStandings(best);

  let progressBy = new Map();
  if (req.user.role === 'student') {
    const visible = assessmentRows.filter((a) => a.status !== 'draft');
    const mine = await Submission.find({
      student: req.user.id, assessment: { $in: visible.map((a) => a._id) }, status: { $in: scoring.FINISHED }
    }).select('assessment status score maxScore').lean();
    const mineBest = scoring.bestByAssessment(mine);
    progressBy = new Map(courses.map((c) => {
      const list = visible.filter((a) => String(a.course) === String(c._id));
      const done = list.filter((a) => mineBest.has(String(a._id)));
      const scored = done.filter((a) => attempts.resultsVisible(a)).map((a) => scoring.percentOf(mineBest.get(String(a._id))));
      return [String(c._id), { completed: done.length, total: list.length, averageScore: scoring.averagePercent(scored) }];
    }));
  }

  const items = courses.map((c) => {
    const item = {
      id: String(c._id),
      title: c.title,
      code: c.code,
      description: c.description,
      term: c.term,
      color: c.color,
      archived: c.archived,
      topics: c.topics,
      instructors: c.instructors.map((i) => ({ id: String(i), name: instructorBy.get(String(i)) || '' })),
      studentCount: (roster.byCourse.get(String(c._id)) || []).length,
      assessmentCount: assessmentRows.filter((a) => String(a.course) === String(c._id)
        && (access.isStaff(req) || a.status !== 'draft')).length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    };
    if (access.isStaff(req)) {
      item.joinCode = c.joinCode;
      item.joinCodeEnabled = c.joinCodeEnabled;
      item.averageScore = scoring.summarizeStandings(standings.filter((st) => st.course === String(c._id))).averageScore;
    } else item.progress = progressBy.get(String(c._id));
    return item;
  });
  res.json({ items, total, page, pageSize });
}));

router.post('/', staffOnly, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!String(body.title || '').trim()) throw badRequest('title is required', { field: 'title' });
  const course = new Course({
    organization: req.user.organization,
    createdBy: req.user.id,
    instructors: [req.user.id]
  });
  await applyCourseFields(course, { ...body, archived: undefined });
  applyPendingLinks(course);
  await course.save();
  await audit(req, 'course.create', { targetType: 'Course', targetId: course._id, meta: { title: course.title } });
  res.status(201).json(await courseView(req, course, { studentCount: 0, assessmentCount: 0 }));
}));

router.post('/join', requireRole('student'), asyncHandler(async (req, res) => {
  const code = String((req.body && req.body.code) || '').trim().toUpperCase();
  if (!code) throw badRequest('code is required', { field: 'code' });
  const course = await Course.findOne({ joinCode: code, organization: req.user.organization, archived: false });
  if (!course || !course.joinCodeEnabled) throw notFound('No open course matches this code');
  // The caller is already a student of this workspace, so joining uses no new seat.
  const existing = await Enrollment.findOne({ course: course._id, student: req.user.id });
  if (existing && existing.status === 'removed') {
    throw forbidden('You were removed from this course. Ask your instructor to add you again.');
  }
  if (!existing) {
    try {
      await Enrollment.create({ organization: req.user.organization, course: course._id, student: req.user.id });
    } catch (err) {
      if (!err || err.code !== 11000) throw err; // joined twice at once: already enrolled
    }
    await audit(req, 'course.join', { targetType: 'Course', targetId: course._id });
  }
  res.json({ course: await courseView(req, course), alreadyEnrolled: !!existing });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const course = await access.loadCourseForMember(req, req.params.id);
  const [roster, assessmentCount] = await Promise.all([
    scoring.activeRoster([course._id]),
    Assessment.countDocuments({
      course: course._id,
      isPractice: { $ne: true },
      status: access.canManageCourse(req, course) ? { $ne: 'archived' } : { $in: ['published', 'closed'] }
    })
  ]);
  const studentCount = (roster.byCourse.get(String(course._id)) || []).length;
  res.json(await courseView(req, course, { studentCount, assessmentCount }));
}));

router.patch('/:id', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  await applyCourseFields(course, req.body || {});
  applyPendingLinks(course);
  await course.save();
  await audit(req, 'course.update', { targetType: 'Course', targetId: course._id, meta: { fields: Object.keys(req.body || {}) } });
  res.json(await courseView(req, course));
}));

router.delete('/:id', requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  course.archived = true;
  await course.save();
  await audit(req, 'course.archive', { targetType: 'Course', targetId: course._id });
  res.json({ message: 'Course archived' });
}));

router.post('/:id/join-code/regenerate', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  course.joinCode = await Course.generateJoinCode();
  await course.save();
  await audit(req, 'course.join_code_regenerate', { targetType: 'Course', targetId: course._id });
  res.json({ joinCode: course.joinCode });
}));

// ---------------------------------------------------------------------------
// Roster and instructors
// ---------------------------------------------------------------------------

router.get('/:id/students', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  // Deactivated accounts are not part of the roster.
  const enrollments = (await Enrollment.find({ course: course._id, status: 'active' })
    .populate('student', 'name email deactivated').lean())
    .filter((e) => e.student && !e.student.deactivated);
  const [best, activity] = await Promise.all([
    scoring.bestAttempts({ courseIds: [course._id] }),
    Submission.aggregate([
      { $match: { course: course._id, isPractice: { $ne: true } } },
      {
        $group: {
          _id: '$student',
          submissions: { $sum: { $cond: [{ $in: ['$status', scoring.FINISHED] }, 1, 0] } },
          lastActivityAt: { $max: { $ifNull: ['$submittedAt', '$startedAt'] } }
        }
      }
    ])
  ]);
  const pctsBy = new Map();
  best.forEach((d) => {
    const list = pctsBy.get(String(d.student)) || [];
    list.push(d.pct);
    pctsBy.set(String(d.student), list);
  });
  const activityBy = new Map(activity.map((a) => [String(a._id), a]));
  const items = enrollments.map((e) => {
    const a = activityBy.get(String(e.student._id));
    return {
      id: String(e.student._id),
      name: e.student.name,
      email: e.student.email,
      enrolledAt: e.enrolledAt,
      averageScore: scoring.averagePercent(pctsBy.get(String(e.student._id)) || []),
      submissions: a ? a.submissions : 0,
      lastActivityAt: a ? a.lastActivityAt : null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  res.json({ items, total: items.length });
}));

router.post('/:id/students', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  const raw = req.body && req.body.emails;
  if (!Array.isArray(raw) || !raw.length) throw badRequest('emails must be a non-empty list', { field: 'emails' });
  if (raw.length > 500) throw badRequest('At most 500 emails at a time', { field: 'emails' });
  const emails = [...new Set(raw.map(normalizeEmail).filter(Boolean))];
  const students = await User.find({
    organization: req.user.organization, email: { $in: emails.filter(isEmail) }, role: 'student', deactivated: { $ne: true }
  }).select('email').lean();
  const found = new Map(students.map((s) => [s.email, s]));
  const existing = await Enrollment.find({ course: course._id, student: { $in: students.map((s) => s._id) } }).lean();
  const activeBefore = new Set(existing.filter((e) => e.status === 'active').map((e) => String(e.student)));

  await Enrollment.bulkWrite(students.map((s) => ({
    updateOne: {
      filter: { course: course._id, student: s._id },
      update: {
        $set: { status: 'active' },
        $setOnInsert: { organization: req.user.organization, enrolledAt: new Date() }
      },
      upsert: true
    }
  })));
  const added = students.filter((s) => !activeBefore.has(String(s._id))).map((s) => s.email);
  await audit(req, 'course.student_add', { targetType: 'Course', targetId: course._id, meta: { added: added.length } });
  res.json({
    added,
    alreadyEnrolled: students.filter((s) => activeBefore.has(String(s._id))).map((s) => s.email),
    notFound: emails.filter((e) => !found.has(e))
  });
}));

router.delete('/:id/students/:studentId', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  if (!mongoose.isValidObjectId(req.params.studentId)) throw notFound('Student not found');
  const result = await Enrollment.updateOne(
    { course: course._id, student: req.params.studentId, status: 'active' },
    { $set: { status: 'removed' } }
  );
  if (!result.matchedCount) throw notFound('Student is not enrolled in this course');
  await audit(req, 'course.student_remove', { targetType: 'Course', targetId: course._id, meta: { student: req.params.studentId } });
  res.json({ message: 'Student removed from course' });
}));

router.post('/:id/instructors', requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  const userId = req.body && req.body.userId;
  if (!mongoose.isValidObjectId(userId)) throw badRequest('userId is required', { field: 'userId' });
  const user = await User.findOne({
    _id: userId, organization: req.user.organization, role: { $in: STAFF_ROLES }, deactivated: { $ne: true }
  }).select('name').lean();
  if (!user) throw notFound('Staff member not found in this workspace');
  if (course.instructors.some((i) => String(i) === String(userId))) throw conflict('Already an instructor of this course');
  course.instructors.push(userId);
  await course.save();
  await audit(req, 'course.instructor_add', { targetType: 'Course', targetId: course._id, meta: { user: String(userId) } });
  res.json(await courseView(req, course));
}));

router.delete('/:id/instructors/:userId', requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  const remaining = course.instructors.filter((i) => String(i) !== String(req.params.userId));
  if (remaining.length === course.instructors.length) throw notFound('Not an instructor of this course');
  if (!remaining.length) throw conflict('A course needs at least one instructor');
  course.instructors = remaining;
  await course.save();
  await audit(req, 'course.instructor_remove', { targetType: 'Course', targetId: course._id, meta: { user: req.params.userId } });
  res.json(await courseView(req, course));
}));

// ---------------------------------------------------------------------------
// Gradebook
// ---------------------------------------------------------------------------

router.get('/:id/gradebook', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  res.json(await gradebook.buildGradebook(course));
}));

router.get('/:id/gradebook.csv', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  const csv = gradebook.toCsv(await gradebook.buildGradebook(course));
  const name = `${(course.code || course.title).replace(/[^\w-]+/g, '_').slice(0, 60) || 'course'}-gradebook.csv`;
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${name}"`);
  await audit(req, 'course.gradebook_export', { targetType: 'Course', targetId: course._id });
  res.send(csv);
}));

module.exports = router;
