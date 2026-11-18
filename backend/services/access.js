/**
 * Course-level access control for the learning domain.
 *
 * Every lookup is scoped to the caller's workspace, so an id from another
 * workspace is always a 404. Within the workspace:
 *  - owner/admin can manage every course;
 *  - an instructor can manage the courses listing them in `instructors`;
 *  - a student can see courses they have an active enrollment in.
 */
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const { notFound, forbidden } = require('../utils/errors');

const ADMIN_ROLES = ['owner', 'admin'];
const STAFF_ROLES = ['owner', 'admin', 'instructor'];

const isAdmin = (req) => ADMIN_ROLES.includes(req.user.role);
const isStaff = (req) => STAFF_ROLES.includes(req.user.role);
const toId = (id) => new mongoose.Types.ObjectId(String(id));
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

function assertId(id, what) {
  if (!mongoose.isValidObjectId(id)) throw notFound(`${what} not found`);
}

/** Mongo filter for the courses the caller can manage. */
function staffCourseFilter(req) {
  const filter = { organization: req.user.organization };
  if (!isAdmin(req)) filter.instructors = toId(req.user.id);
  return filter;
}

/** Ids of the courses the caller can manage (admins: every course in the workspace). */
async function staffCourseIds(req) {
  const courses = await Course.find(staffCourseFilter(req)).select('_id').lean();
  return courses.map((c) => c._id);
}

/** Ids of the courses a student is actively enrolled in. */
async function enrolledCourseIds(req) {
  const rows = await Enrollment.find({ organization: req.user.organization, student: req.user.id, status: 'active' })
    .select('course')
    .lean();
  return rows.map((r) => r.course);
}

function canManageCourse(req, course) {
  return isAdmin(req) || (req.user.role === 'instructor' && (course.instructors || []).some((i) => sameId(i, req.user.id)));
}

/** The course document when the caller can manage it; 404/403 otherwise. */
async function loadCourseForStaff(req, courseId) {
  assertId(courseId, 'Course');
  const course = await Course.findOne({ _id: courseId, organization: req.user.organization });
  if (!course) throw notFound('Course not found');
  if (canManageCourse(req, course)) return course;
  if (isStaff(req)) throw forbidden('You do not teach this course');
  throw notFound('Course not found');
}

/** The course document when the caller teaches it or is actively enrolled in it. */
async function loadCourseForMember(req, courseId) {
  assertId(courseId, 'Course');
  const course = await Course.findOne({ _id: courseId, organization: req.user.organization });
  if (!course) throw notFound('Course not found');
  if (canManageCourse(req, course)) return course;
  if (req.user.role === 'student') {
    const enrolled = await Enrollment.exists({ course: course._id, student: req.user.id, status: 'active' });
    if (enrolled) return course;
  } else if (isStaff(req)) {
    throw forbidden('You do not teach this course');
  }
  throw notFound('Course not found');
}

/** { assessment, course } for staff of the assessment's course. */
async function loadAssessmentForStaff(req, assessmentId) {
  assertId(assessmentId, 'Assessment');
  const assessment = await Assessment.findOne({ _id: assessmentId, organization: req.user.organization });
  if (!assessment) throw notFound('Assessment not found');
  const course = await loadCourseForStaff(req, assessment.course);
  return { assessment, course };
}

/**
 * { assessment, course } for an enrolled student. Drafts, archived assessments
 * and other students' practice quizzes are invisible (404).
 */
async function loadAssessmentForStudent(req, assessmentId) {
  assertId(assessmentId, 'Assessment');
  const assessment = await Assessment.findOne({
    _id: assessmentId,
    organization: req.user.organization,
    status: { $in: ['published', 'closed'] }
  });
  if (!assessment) throw notFound('Assessment not found');
  if (assessment.isPractice && !sameId(assessment.practiceFor, req.user.id)) throw notFound('Assessment not found');
  const course = await loadCourseForMember(req, assessment.course);
  return { assessment, course };
}

/**
 * { submission, isOwner } for the student who owns it or staff of its course.
 * Other students get a 404.
 */
async function loadSubmissionForViewer(req, submissionId) {
  assertId(submissionId, 'Submission');
  const submission = await Submission.findOne({ _id: submissionId, organization: req.user.organization });
  if (!submission) throw notFound('Submission not found');
  if (sameId(submission.student, req.user.id)) return { submission, isOwner: true };
  if (!isStaff(req)) throw notFound('Submission not found');
  await loadCourseForStaff(req, submission.course);
  return { submission, isOwner: false };
}

module.exports = {
  ADMIN_ROLES,
  STAFF_ROLES,
  isAdmin,
  isStaff,
  toId,
  sameId,
  staffCourseFilter,
  staffCourseIds,
  enrolledCourseIds,
  canManageCourse,
  loadCourseForStaff,
  loadCourseForMember,
  loadAssessmentForStaff,
  loadAssessmentForStudent,
  loadSubmissionForViewer
};
