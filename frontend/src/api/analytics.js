import api, { getData } from './client';

// Analytics (/api/analytics).
export const getOverview = () => getData(api.get('/analytics/overview'));
export const getCourseAnalytics = (id) => getData(api.get(`/analytics/courses/${id}`));
export const getAssessmentAnalytics = (id) => getData(api.get(`/analytics/assessments/${id}`));
export const getMyAnalytics = () => getData(api.get('/analytics/me'));
