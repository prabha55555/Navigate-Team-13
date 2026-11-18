/**
 * Analytics endpoints. See docs/ARCHITECTURE.md §5 "Analytics".
 */
const express = require('express');
const { requireAuth, requireRole, STAFF_ROLES } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/errors');
const access = require('../services/access');
const analytics = require('../services/analyticsService');

const router = express.Router();
router.use(requireAuth);
const staffOnly = requireRole(...STAFF_ROLES);

router.get('/overview', staffOnly, asyncHandler(async (req, res) => {
  res.json(await analytics.overview(access.staffCourseFilter(req)));
}));

router.get('/courses/:id', staffOnly, asyncHandler(async (req, res) => {
  const course = await access.loadCourseForStaff(req, req.params.id);
  res.json(await analytics.courseAnalytics(course));
}));

router.get('/assessments/:id', staffOnly, asyncHandler(async (req, res) => {
  const { assessment, course } = await access.loadAssessmentForStaff(req, req.params.id);
  res.json(await analytics.assessmentAnalytics(assessment, course));
}));

router.get('/me', requireRole('student'), asyncHandler(async (req, res) => {
  res.json(await analytics.studentAnalytics(req.user.organization, req.user.id));
}));

module.exports = router;
