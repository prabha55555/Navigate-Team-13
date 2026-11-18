import api, { getData } from './client';

// Assessments (/api/assessments).
/** params: { courseId?, status?, q?, practice?, page?, pageSize?, sort? } → { items, total, page, pageSize } */
export const listAssessments = (params) => getData(api.get('/assessments', { params }));
export const getAssessment = (id) => getData(api.get(`/assessments/${id}`));
export const createAssessment = (body) => getData(api.post('/assessments', body));
/** `force: true` allows text/explanation edits once submissions exist. */
export const updateAssessment = (id, body, { force } = {}) =>
  getData(api.patch(`/assessments/${id}`, body, { params: force ? { force: true } : undefined }));
/** Archive. */
export const archiveAssessment = (id) => getData(api.delete(`/assessments/${id}`));
export const publishAssessment = (id) => getData(api.post(`/assessments/${id}/publish`));
export const closeAssessment = (id) => getData(api.post(`/assessments/${id}/close`));
export const duplicateAssessment = (id) => getData(api.post(`/assessments/${id}/duplicate`));
export const releaseResults = (id) => getData(api.post(`/assessments/${id}/release-results`));
/** params: { status? } → { items, total } */
export const listAssessmentSubmissions = (id, params) =>
  getData(api.get(`/assessments/${id}/submissions`, { params }));
/** Student: start or resume → { submission, assessment } */
export const startAttempt = (id) => getData(api.post(`/assessments/${id}/attempts`));
/** Archived → draft. */
export const restoreAssessment = (id) => getData(api.post(`/assessments/${id}/restore`));
/** Published → draft; 409 `has-submissions` once a student has started. */
export const unpublishAssessment = (id) => getData(api.post(`/assessments/${id}/unpublish`));
