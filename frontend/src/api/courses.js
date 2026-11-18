import api, { filenameFrom, getData, saveBlob } from './client';

// Courses (/api/courses).
/** params: { archived?, q?, page?, pageSize? } → { items, total, page, pageSize } */
export const listCourses = (params) => getData(api.get('/courses', { params }));
export const getCourse = (id) => getData(api.get(`/courses/${id}`));
export const createCourse = (body) => getData(api.post('/courses', body));
export const updateCourse = (id, body) => getData(api.patch(`/courses/${id}`, body));
/** Soft-archive (owner/admin). */
export const archiveCourse = (id) => getData(api.delete(`/courses/${id}`));
/** → { joinCode } */
export const regenerateJoinCode = (id) => getData(api.post(`/courses/${id}/join-code/regenerate`));
/** Student joins by code → { course, alreadyEnrolled } */
export const joinCourse = (code) => getData(api.post('/courses/join', { code }));
export const getRoster = (id, params) => getData(api.get(`/courses/${id}/students`, { params }));
/** → { added, alreadyEnrolled, notFound } */
export const addStudents = (id, emails) => getData(api.post(`/courses/${id}/students`, { emails }));
export const removeStudent = (id, studentId) => getData(api.delete(`/courses/${id}/students/${studentId}`));
export const addInstructor = (id, userId) => getData(api.post(`/courses/${id}/instructors`, { userId }));
export const removeInstructor = (id, userId) => getData(api.delete(`/courses/${id}/instructors/${userId}`));
export const getGradebook = (id) => getData(api.get(`/courses/${id}/gradebook`));
/** Downloads the gradebook CSV in the browser. Resolves once the download starts. */
export const downloadGradebookCsv = async (id, fallbackName = 'gradebook.csv') => {
  const res = await api.get(`/courses/${id}/gradebook.csv`, { responseType: 'blob' });
  saveBlob(res.data, filenameFrom(res.headers, fallbackName));
};
