/**
 * Adaptive learning for students. See docs/ARCHITECTURE.md §5 "Adaptive learning".
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimits');
const { asyncHandler } = require('../utils/errors');
const access = require('../services/access');
const learningPath = require('../services/learningPathService');

const router = express.Router();
router.use(requireAuth, requireRole('student'));

router.get('/:courseId', asyncHandler(async (req, res) => {
  const course = await access.loadCourseForMember(req, req.params.courseId);
  res.json(await learningPath.getLearningPath(course, req.user.id));
}));

router.post('/:courseId/practice', aiLimiter, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForMember(req, req.params.courseId);
  const body = req.body || {};
  const result = await learningPath.createPracticeQuiz(req, course, { topics: body.topics, questionCount: body.questionCount });
  res.status(201).json(result);
}));

module.exports = router;
