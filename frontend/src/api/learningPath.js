import api, { getData } from './client';

// Adaptive learning (/api/learning-path). Recommendations may wait on Gemini, so allow longer.
export const getLearningPath = (courseId) => getData(api.get(`/learning-path/${courseId}`, { timeout: 60000 }));
/** body: { topics?, questionCount? } → { assessmentId, questionCount, topics, generatedBy } */
export const createPracticeQuiz = (courseId, body = {}) =>
  getData(api.post(`/learning-path/${courseId}/practice`, body, { timeout: 120000 }));
