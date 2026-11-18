/**
 * Workspace question bank (staff only). Items can be workspace-wide or tied to
 * a course; instructors see workspace-wide items plus those of their courses.
 */
const express = require('express');
const mongoose = require('mongoose');
const QuestionBankItem = require('../models/QuestionBankItem');
const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const { requireAuth, requireRole, STAFF_ROLES } = require('../middlewares/auth');
const { asyncHandler, badRequest, conflict, notFound } = require('../utils/errors');
const { pagination, escapeRegex } = require('../utils/validate');
const { serialize } = require('../utils/serialize');
const access = require('../services/access');
const { cleanQuestion, cleanQuestions, normalizeDifficulty } = require('../services/questions');
const { audit } = require('../services/audit');

const router = express.Router();
router.use(requireAuth, requireRole(...STAFF_ROLES));

const MAX_BATCH = 200;

const cleanTags = (tags) => (Array.isArray(tags)
  ? [...new Set(tags.map((t) => String(t || '').trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20)
  : []);

/** Course filter for bank items the caller may see: workspace-wide items plus their courses'. */
async function visibleFilter(req) {
  const filter = { organization: req.user.organization };
  if (!access.isAdmin(req)) filter.course = { $in: [null, ...(await access.staffCourseIds(req))] };
  return filter;
}

/**
 * Adds `usageCount` = number of (non-practice, non-archived) assessments in the
 * workspace that contain the question, whether it was imported from the bank
 * or the bank item was saved from that assessment. Matched by question text.
 */
async function withUsage(orgId, items) {
  const texts = [...new Set(items.map((i) => i.text))];
  const rows = texts.length ? await Assessment.aggregate([
    { $match: { organization: new mongoose.Types.ObjectId(String(orgId)), isPractice: { $ne: true }, status: { $ne: 'archived' }, 'questions.text': { $in: texts } } },
    { $unwind: '$questions' },
    { $match: { 'questions.text': { $in: texts } } },
    { $group: { _id: '$questions.text', assessments: { $addToSet: '$_id' } } }
  ]) : [];
  const countBy = new Map(rows.map((r) => [r._id, r.assessments.length]));
  return items.map((i) => ({ ...i, usageCount: countBy.get(i.text) || 0 }));
}

async function loadItem(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Question not found');
  const item = await QuestionBankItem.findOne({ _id: req.params.id, ...(await visibleFilter(req)) });
  if (!item) throw notFound('Question not found');
  return item;
}

router.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pagination(req.query, { defaultSize: 50, maxSize: 200 });
  const filter = await visibleFilter(req);
  if (req.query.courseId) filter.course = (await access.loadCourseForStaff(req, req.query.courseId))._id;
  if (req.query.topic) filter.topic = String(req.query.topic);
  if (req.query.type) filter.type = String(req.query.type);
  if (req.query.difficulty) filter.difficulty = normalizeDifficulty(req.query.difficulty);
  if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase();
  if (req.query.q) filter.text = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
  const [items, total, topics] = await Promise.all([
    QuestionBankItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    QuestionBankItem.countDocuments(filter),
    QuestionBankItem.distinct('topic', await visibleFilter(req))
  ]);
  res.json({ items: await withUsage(req.user.organization, serialize(items)), total, page, pageSize, topics: topics.filter(Boolean).sort() });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const batch = Array.isArray(body.items);
  const inputs = batch ? body.items : [body];
  if (!inputs.length || inputs.length > MAX_BATCH) throw badRequest(`Send between 1 and ${MAX_BATCH} questions`, { field: 'items' });
  const courseId = body.courseId || null;
  const course = courseId ? await access.loadCourseForStaff(req, courseId) : null;
  const docs = inputs.map((raw, i) => {
    const { id, ...question } = cleanQuestion(raw, i); // eslint-disable-line no-unused-vars
    const itemCourse = raw && raw.courseId && !course ? raw.courseId : null;
    return {
      ...question,
      organization: req.user.organization,
      course: course ? course._id : itemCourse,
      createdBy: req.user.id,
      tags: cleanTags(raw && raw.tags)
    };
  });
  // Items naming their own course must be for a course the caller manages.
  const perItemCourses = [...new Set(docs.map((d) => d.course).filter((c) => c && !course).map(String))];
  await Promise.all(perItemCourses.map((id) => access.loadCourseForStaff(req, id)));
  const created = await QuestionBankItem.insertMany(docs);
  await audit(req, 'question_bank.create', { targetType: 'QuestionBankItem', meta: { count: created.length } });
  const items = await withUsage(req.user.organization, created.map((d) => d.toJSON()));
  res.status(201).json(batch ? { items } : items[0]);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const item = await loadItem(req);
  const merged = { ...item.toObject(), ...(req.body || {}) };
  const { id, ...question } = cleanQuestion(merged, 0); // eslint-disable-line no-unused-vars
  Object.assign(item, question);
  if (req.body && req.body.tags !== undefined) item.tags = cleanTags(req.body.tags);
  if (req.body && req.body.courseId !== undefined) {
    item.course = req.body.courseId ? (await access.loadCourseForStaff(req, req.body.courseId))._id : null;
  }
  await item.save();
  await audit(req, 'question_bank.update', { targetType: 'QuestionBankItem', targetId: item._id });
  res.json((await withUsage(req.user.organization, [item.toJSON()]))[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const item = await loadItem(req);
  await item.deleteOne();
  await audit(req, 'question_bank.delete', { targetType: 'QuestionBankItem', targetId: item._id });
  res.json({ message: 'Question deleted' });
}));

/** Appends bank questions to an assessment that has no submissions yet. */
router.post('/import-to/:assessmentId', asyncHandler(async (req, res) => {
  const { assessment } = await access.loadAssessmentForStaff(req, req.params.assessmentId);
  const ids = (req.body && req.body.ids) || [];
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_BATCH) {
    throw badRequest(`ids must list between 1 and ${MAX_BATCH} questions`, { field: 'ids' });
  }
  if (await Submission.exists({ assessment: assessment._id })) {
    throw conflict('Students have already started this assessment; questions can no longer be added');
  }
  const items = await QuestionBankItem.find({
    _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) },
    ...(await visibleFilter(req))
  }).lean();
  if (!items.length) throw notFound('None of these questions were found');
  // Keep the requested order.
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const picked = ids.map((id) => byId.get(String(id))).filter(Boolean);
  const existing = assessment.questions.map((q) => (typeof q.toObject === 'function' ? q.toObject() : q));
  assessment.questions = cleanQuestions([
    ...existing,
    ...picked.map(({ _id, ...q }) => ({ ...q, id: `b${String(_id).slice(-8)}` }))
  ]);
  if (assessment.source === 'manual' && !existing.length) assessment.source = 'bank';
  await assessment.save();
  await audit(req, 'question_bank.import', { targetType: 'Assessment', targetId: assessment._id, meta: { count: picked.length } });
  res.json({ added: picked.length, questionCount: assessment.questions.length, totalPoints: assessment.totalPoints });
}));

module.exports = router;
