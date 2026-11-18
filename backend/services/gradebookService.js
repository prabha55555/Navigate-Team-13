/**
 * Course gradebook: one row per actively enrolled student, one column per
 * published/closed (non-practice) assessment. A cell holds the student's best
 * finished attempt.
 */
const Assessment = require('../models/Assessment');
const Enrollment = require('../models/Enrollment');
const Submission = require('../models/Submission');
const { FINISHED, percentOf, averagePercent } = require('./scoring');

async function buildGradebook(course) {
  const [assessments, enrollments] = await Promise.all([
    Assessment.find({ course: course._id, isPractice: { $ne: true }, status: { $in: ['published', 'closed'] } })
      .select('title totalPoints dueDate status')
      .sort({ dueDate: 1, createdAt: 1 })
      .lean(),
    Enrollment.find({ course: course._id, status: 'active' }).populate('student', 'name email deactivated').lean()
  ]);
  // Deactivated accounts are not part of the roster.
  const students = enrollments.filter((e) => e.student && !e.student.deactivated).map((e) => e.student);
  const submissions = await Submission.find({
    course: course._id,
    assessment: { $in: assessments.map((a) => a._id) },
    student: { $in: students.map((s) => s._id) }
  }).select('assessment student status percentage score maxScore attempt').lean();

  // cell key "studentId:assessmentId" → best finished attempt (or the in-progress one)
  const cells = new Map();
  submissions.forEach((s) => {
    const key = `${s.student}:${s.assessment}`;
    const current = cells.get(key);
    const finished = FINISHED.includes(s.status);
    if (!current
      || (finished && current.status === 'in-progress')
      || (finished && percentOf(s) > percentOf(current))) cells.set(key, s);
  });

  const now = new Date();
  const rows = students
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((student) => {
      const scores = {};
      const graded = [];
      assessments.forEach((a) => {
        const s = cells.get(`${student._id}:${a._id}`);
        if (s) {
          scores[String(a._id)] = {
            percentage: s.status === 'in-progress' ? null : s.percentage,
            score: s.status === 'in-progress' ? null : s.score,
            status: s.status,
            submissionId: String(s._id)
          };
          if (FINISHED.includes(s.status)) graded.push(percentOf(s));
        } else {
          const missing = a.status === 'closed' || (a.dueDate && a.dueDate < now);
          scores[String(a._id)] = { percentage: null, score: null, status: missing ? 'missing' : 'not-started', submissionId: null };
        }
      });
      return {
        student: { id: String(student._id), name: student.name, email: student.email },
        scores,
        // Unrounded best-attempt percentages, rounded once (same basis as analytics).
        average: averagePercent(graded)
      };
    });

  return {
    assessments: assessments.map((a) => ({
      id: String(a._id), title: a.title, totalPoints: a.totalPoints, dueDate: a.dueDate || null, status: a.status
    })),
    rows
  };
}

/** One CSV field: quoted when needed, with spreadsheet formula injection neutralised. */
function csvField(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Gradebook as CSV text (UTF-8 BOM so Excel detects the encoding). */
function toCsv(gradebook) {
  const header = ['Student', 'Email', ...gradebook.assessments.map((a) => `${a.title} (%)`), 'Average (%)'];
  const lines = [header.map(csvField).join(',')];
  gradebook.rows.forEach((row) => {
    const cells = gradebook.assessments.map((a) => {
      const cell = row.scores[a.id];
      if (cell.percentage !== null && cell.percentage !== undefined) return cell.percentage;
      return cell.status === 'missing' ? 'missing' : '';
    });
    lines.push([row.student.name, row.student.email, ...cells, row.average].map(csvField).join(','));
  });
  return `﻿${lines.join('\r\n')}\r\n`;
}

module.exports = { buildGradebook, toCsv, csvField };
