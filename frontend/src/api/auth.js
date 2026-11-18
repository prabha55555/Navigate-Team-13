import api, { getData } from './client';

// Auth endpoints (/api/auth). Every function resolves to the response body.
export const login = (email, password) => getData(api.post('/auth/login', { email, password }));
/** body: { name, email, password, mode: 'create-workspace', workspaceName } | { name, email, password, mode: 'join', code } */
export const register = (body) => getData(api.post('/auth/register', body));
export const refreshToken = (token) => getData(api.post('/auth/refresh-token', { refreshToken: token }));
export const logout = (token) => getData(api.post('/auth/logout', { refreshToken: token }));
/** → { user, workspace } */
export const getMe = () => getData(api.get('/auth/me'));
/** body: { name?, preferences? } → { user } */
export const updateMe = (body) => getData(api.patch('/auth/me', body));
/** → { message, token, refreshToken } */
export const changePassword = (currentPassword, newPassword) =>
  getData(api.post('/auth/change-password', { currentPassword, newPassword }));
/** → { message, devResetUrl? } */
export const forgotPassword = (email) => getData(api.post('/auth/forgot-password', { email }));
export const resetPassword = (token, password) => getData(api.post('/auth/reset-password', { token, password }));
/** → { workspace: { name }, role, kind: 'invite'|'course', course? } */
export const previewInvite = (code) => getData(api.get(`/auth/invite/${encodeURIComponent(code)}`));
