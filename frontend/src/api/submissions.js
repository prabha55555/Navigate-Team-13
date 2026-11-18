import api, { getData } from './client';

// Submissions (/api/submissions).
/** Student history. params: { courseId?, practice?, page?, pageSize? } → { items, ... } */
export const getMySubmissions = (params) => getData(api.get('/submissions/mine', { params }));
export const getSubmission = (id) => getData(api.get(`/submissions/${id}`));
/** → { savedAt, saved } */
export const autosaveAnswers = (id, answers) => getData(api.patch(`/submissions/${id}/answers`, { answers }));
/** event: { type, detail? } → { violationCount, terminated } */
export const reportIntegrityEvent = (id, event) => getData(api.post(`/submissions/${id}/events`, event));
/** → result view + lateAnswersRejected */
export const submitSubmission = (id, answers) =>
  getData(api.post(`/submissions/${id}/submit`, answers ? { answers } : {}));
/** body: { questionScores?, overrideScore?, comment? } → staff result view */
export const gradeSubmission = (id, body) => getData(api.patch(`/submissions/${id}/grade`, body));
