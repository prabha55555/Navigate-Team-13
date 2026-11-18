import api, { getData } from './client';

// Workspace endpoints (/api/workspace).
/** → { workspace } */
export const getWorkspace = () => getData(api.get('/workspace'));
/** body: { name?, branding?, settings? } → { workspace } */
export const updateWorkspace = (body) => getData(api.patch('/workspace', body));
/** params: { role?, q?, page?, pageSize? } → { items, total, page, pageSize } */
export const listMembers = (params) => getData(api.get('/workspace/members', { params }));
/** body: { role?, deactivated? } → { member } */
export const updateMember = (id, body) => getData(api.patch(`/workspace/members/${id}`, body));
export const removeMember = (id) => getData(api.delete(`/workspace/members/${id}`));
/** → { items: [{ id, code, role, expiresAt, maxUses, uses, revoked, url, status }], total, page, pageSize } */
export const listInvites = (params) => getData(api.get('/workspace/invites', { params }));
/** body: { role, expiresInDays?, maxUses? } → { invite, url } */
export const createInvite = (body) => getData(api.post('/workspace/invites', body));
export const revokeInvite = (id) => getData(api.delete(`/workspace/invites/${id}`));
/** → { plan, limits, usage: { staffSeats, students, aiGenerations } } */
export const getUsage = () => getData(api.get('/workspace/usage'));
/** → { plans, currentPlan, billingMode: 'demo'|'contact-sales' } */
export const listPlans = () => getData(api.get('/workspace/plans'));
/** → { workspace } in demo billing; otherwise rejects with ApiError code CONTACT_SALES */
export const changePlan = (plan) => getData(api.post('/workspace/plan', { plan }));
/** params: { page?, pageSize? } → { items: [{ id, action, targetType, targetId, meta, ip, createdAt, actor }], total, page, pageSize } */
export const getAuditLog = (params) => getData(api.get('/workspace/audit-log', { params }));
