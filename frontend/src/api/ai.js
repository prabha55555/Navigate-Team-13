import api, { getData } from './client';

// AI tools (/api/assessment/*). Gemini can be slow, so these allow up to 120 s.
const AI_TIMEOUT = 120000;

/** Multipart upload (field `file`, PDF/DOCX/TXT ≤ 10 MB). → { success, syllabusContent, fileName } */
export const uploadSyllabus = (file, { onUploadProgress } = {}) => {
  const form = new FormData();
  form.append('file', file);
  return getData(api.post('/assessment/upload-syllabus', form, { timeout: AI_TIMEOUT, onUploadProgress }));
};
/** body: { syllabusContent, courseId? } */
export const analyzeSyllabus = (body) => getData(api.post('/assessment/analyze-syllabus', body, { timeout: AI_TIMEOUT }));
/** body: { syllabusAnalysis, pattern } */
export const generateQuestions = (body) => getData(api.post('/assessment/generate-questions', body, { timeout: AI_TIMEOUT }));
/** body: { currentQuiz, feedback } */
export const getAssessmentTemplates = (courseId = 'default') =>
  getData(api.get(`/assessment/templates/${encodeURIComponent(courseId)}`));
