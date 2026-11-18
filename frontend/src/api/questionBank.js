import api, { getData } from './client';

// Question bank (/api/question-bank), staff only.
/** params: { courseId?, topic?, type?, difficulty?, tag?, q?, page?, pageSize? } → { items, total, page, pageSize, topics } */
export const listQuestions = (params) => getData(api.get('/question-bank', { params }));
/** One question body. */
export const createQuestion = (body) => getData(api.post('/question-bank', body));
/** Bulk create (≤ 200). */
export const createQuestions = (items, courseId) => getData(api.post('/question-bank', { courseId, items }));
export const updateQuestion = (id, body) => getData(api.patch(`/question-bank/${id}`, body));
export const deleteQuestion = (id) => getData(api.delete(`/question-bank/${id}`));
/** → { added, questionCount, totalPoints } */
export const importToAssessment = (assessmentId, ids) =>
  getData(api.post(`/question-bank/import-to/${assessmentId}`, { ids }));
