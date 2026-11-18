/**
 * Workspace administration (docs/ARCHITECTURE.md §5 "Workspace").
 * Every query is scoped to req.user.organization; other workspaces' ids are 404s.
 */
const express = require('express');
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Invite = require('../models/Invite');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireRole, invalidateUserCache, ADMIN_ROLES } = require('../middlewares/auth');
const { asyncHandler, AppError, badRequest, conflict, forbidden, notFound } = require('../utils/errors');
const { oneOf, str, clampInt, assertObjectId, pagination, escapeRegex } = require('../utils/validate');
const { serialize } = require('../utils/serialize');
const { getLimits, getUsage, assertSeatAvailable } = require('../services/plans');
const { notify, notifyRoles } = require('../services/notify');
const { audit } = require('../services/audit');
const { randomCode } = require('../services/tokens');
const { toWorkspaceDTO } = require('../services/workspace');
const { PLANS, PLAN_IDS } = require('../config/plans');
const env = require('../config/env');

const router = express.Router();
router.use(requireAuth);

const adminOnly = requireRole(...ADMIN_ROLES);
const staffOnly = requireRole('instructor');
const ownerOnly = requireRole('owner');

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HTTP_URL = /^https?:\/\/\S+$/i;

const loadOrg = async (req) => {
  const org = await Organization.findById(req.user.organization);
  if (!org) throw notFound('Workspace not found');
  return org;
};

const memberDTO = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  avatarColor: u.avatarColor,
  lastLoginAt: u.lastLoginAt || null,
  deactivated: Boolean(u.deactivated),
  createdAt: u.createdAt
});

/** Audit meta identifying a member, so log entries stay readable after renames/removals. */
const memberMeta = (u) => ({ name: u.name, email: u.email, role: u.role });

const inviteUrl = (code) => `${env.appUrl()}/join/${code}`;

const inviteDTO = (invite) => {
  const plain = serialize(invite);
  const reason = invite.unusableReason();
  return { ...plain, url: inviteUrl(invite.code), status: invite.revoked ? 'revoked' : (reason ? 'expired' : 'active') };
};

/** Loads a member of the caller's workspace or throws 404. */
async function findMember(req) {
  assertObjectId(req.params.id, 'Member');
  const member = await User.findOne({ _id: req.params.id, organization: req.user.organization });
  if (!member) throw notFound('Member not found');
  return member;
}

/** Owners can only be changed by owners; nobody may leave the workspace without an active owner. */
async function assertCanModify(req, member, { removesOwner }) {
  if (member.role === 'owner' && req.user.role !== 'owner') throw forbidden('Only owners can change another owner');
  if (removesOwner) {
    const owners = await User.countDocuments({ organization: req.user.organization, role: 'owner', deactivated: { $ne: true } });
    if (owners <= 1) throw conflict('A workspace needs at least one owner. Make someone else an owner first.');
  }
}

// GET /api/workspace
router.get('/', asyncHandler(async (req, res) => {
  res.json({ workspace: await toWorkspaceDTO(await loadOrg(req)) });
}));

// PATCH /api/workspace
router.patch('/', adminOnly, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const org = await loadOrg(req);
  const changed = [];
  if (body.name !== undefined) {
    org.name = str(body.name, { field: 'name', max: 120, required: true });
    changed.push('name');
  }
  if (body.branding && typeof body.branding === 'object') {
    const { primaryColor, logoUrl } = body.branding;
    if (primaryColor !== undefined) {
      if (!HEX_COLOR.test(primaryColor)) throw badRequest('primaryColor must be a hex color like #4f46e5', { field: 'branding.primaryColor' });
      org.branding.primaryColor = primaryColor;
    }
    if (logoUrl !== undefined) {
      if (logoUrl !== '' && (!HTTP_URL.test(logoUrl) || logoUrl.length > 2000)) {
        throw badRequest('logoUrl must be an http(s) URL', { field: 'branding.logoUrl' });
      }
      org.branding.logoUrl = logoUrl;
    }
    changed.push('branding');
  }
  if (body.settings && typeof body.settings === 'object' && body.settings.allowStudentSelfSignup !== undefined) {
    org.settings.allowStudentSelfSignup = Boolean(body.settings.allowStudentSelfSignup);
    changed.push('settings');
  }
  await org.save();
  await audit(req, 'workspace.update', { targetType: 'Organization', targetId: org._id, meta: { changed } });
  res.json({ workspace: await toWorkspaceDTO(org) });
}));

// GET /api/workspace/members?role=&q=&page=&pageSize=
router.get('/members', staffOnly, asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pagination(req.query, { defaultSize: 50, maxSize: 200 });
  const filter = { organization: req.user.organization };
  if (req.query.role) filter.role = oneOf(req.query.role, User.ROLES, 'role');
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: 1 }).skip(skip).limit(pageSize).lean(),
    User.countDocuments(filter)
  ]);
  res.json({ items: items.map(memberDTO), total, page, pageSize });
}));

// PATCH /api/workspace/members/:id  { role?, deactivated? }
router.patch('/members/:id', adminOnly, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const member = await findMember(req);
  const isSelf = String(member._id) === req.user.id;
  const newRole = body.role !== undefined ? oneOf(body.role, User.ROLES, 'role') : member.role;
  const deactivate = body.deactivated !== undefined ? Boolean(body.deactivated) : member.deactivated;

  if (newRole === 'owner' && member.role !== 'owner' && req.user.role !== 'owner') {
    throw forbidden('Only owners can make someone an owner');
  }
  if (isSelf && deactivate && !member.deactivated) throw badRequest('You cannot deactivate your own account');
  const removesOwner = member.role === 'owner' && !member.deactivated && (newRole !== 'owner' || deactivate);
  await assertCanModify(req, member, { removesOwner });

  // Seat check when the member moves into a different seat pool or is reactivated.
  const pool = (role) => (role === 'student' ? 'student' : 'staff');
  const reactivating = member.deactivated && !deactivate;
  if (!deactivate && (reactivating || pool(newRole) !== pool(member.role))) {
    await assertSeatAvailable(req.user.organization, newRole);
  }

  const before = { role: member.role, deactivated: member.deactivated };
  member.role = newRole;
  member.deactivated = deactivate;
  await member.save();
  invalidateUserCache(member._id);

  if (before.role !== newRole) {
    await audit(req, 'member.role_change', { targetType: 'User', targetId: member._id, meta: { ...memberMeta(member), from: before.role, to: newRole } });
    await notify(member._id, {
      type: 'member.role_changed',
      title: `Your role is now ${newRole}`,
      body: `${req.user.name} changed your role from ${before.role} to ${newRole}.`,
      link: '/app'
    }, req.user.organization);
  }
  if (before.deactivated !== deactivate) {
    await audit(req, deactivate ? 'member.deactivate' : 'member.reactivate', { targetType: 'User', targetId: member._id, meta: memberMeta(member) });
  }
  res.json({ member: memberDTO(member) });
}));

// DELETE /api/workspace/members/:id — deactivates and removes course enrollments
router.delete('/members/:id', adminOnly, asyncHandler(async (req, res) => {
  const member = await findMember(req);
  if (String(member._id) === req.user.id) throw badRequest('You cannot remove yourself from the workspace');
  await assertCanModify(req, member, { removesOwner: member.role === 'owner' && !member.deactivated });

  member.deactivated = true;
  await member.save();
  invalidateUserCache(member._id);
  const Enrollment = mongoose.models.Enrollment;
  if (Enrollment) {
    await Enrollment.updateMany({ organization: req.user.organization, student: member._id }, { $set: { status: 'removed' } });
  }
  await audit(req, 'member.remove', { targetType: 'User', targetId: member._id, meta: memberMeta(member) });
  res.json({ message: 'Member removed', member: memberDTO(member) });
}));

// GET /api/workspace/invites
router.get('/invites', adminOnly, asyncHandler(async (req, res) => {
  const invites = await Invite.find({ organization: req.user.organization }).sort({ createdAt: -1 }).limit(200);
  res.json({ items: invites.map(inviteDTO), total: invites.length, page: 1, pageSize: invites.length });
}));

// POST /api/workspace/invites  { role, expiresInDays?, maxUses? }
router.post('/invites', adminOnly, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const role = oneOf(body.role, ['admin', 'instructor', 'student'], 'role');
  const expiresInDays = clampInt(body.expiresInDays, 1, 365, 14);
  const maxUses = body.maxUses == null || body.maxUses === '' ? null : clampInt(body.maxUses, 1, 10000, 1);

  const invite = await Invite.create({
    organization: req.user.organization,
    code: randomCode(12),
    role,
    createdBy: req.user.id,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    maxUses
  });
  await audit(req, 'invite.create', { targetType: 'Invite', targetId: invite._id, meta: { code: invite.code, role, maxUses, expiresInDays } });
  // `code` lets the frontend build the join URL from its own origin; `url` uses APP_URL.
  res.status(201).json({ invite: inviteDTO(invite), code: invite.code, url: inviteUrl(invite.code) });
}));

// DELETE /api/workspace/invites/:id — revoke
router.delete('/invites/:id', adminOnly, asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Invite');
  const invite = await Invite.findOneAndUpdate(
    { _id: req.params.id, organization: req.user.organization },
    { $set: { revoked: true } },
    { new: true }
  );
  if (!invite) throw notFound('Invite not found');
  await audit(req, 'invite.revoke', { targetType: 'Invite', targetId: invite._id, meta: { code: invite.code, role: invite.role } });
  res.json({ invite: inviteDTO(invite) });
}));

// GET /api/workspace/usage
router.get('/usage', adminOnly, asyncHandler(async (req, res) => {
  const org = await loadOrg(req);
  res.json({ plan: org.plan, limits: getLimits(org.plan), usage: await getUsage(org._id) });
}));

// GET /api/workspace/plans — plan catalog
router.get('/plans', asyncHandler(async (req, res) => {
  const org = await loadOrg(req);
  res.json({ plans: PLAN_IDS.map((id) => PLANS[id]), currentPlan: org.plan, billingMode: env.billingMode() });
}));

// POST /api/workspace/plan  { plan }
router.post('/plan', ownerOnly, asyncHandler(async (req, res) => {
  const plan = oneOf(req.body && req.body.plan, PLAN_IDS, 'plan');
  const org = await loadOrg(req);
  if (org.plan === plan) return res.json({ workspace: await toWorkspaceDTO(org) });

  if (env.billingMode() !== 'demo') {
    await audit(req, 'plan.upgrade_request', { targetType: 'Organization', targetId: org._id, meta: { from: org.plan, to: plan } });
    await notifyRoles(org._id, ['owner'], {
      type: 'plan.upgrade_requested',
      title: `Plan change to ${PLANS[plan].name} requested`,
      body: `${req.user.name} asked to move the workspace to the ${PLANS[plan].name} plan. Our sales team will be in touch.`,
      link: '/app/settings/billing'
    });
    throw new AppError(402, 'CONTACT_SALES', 'Online payments are not available yet. We recorded your request and our sales team will contact you.', { plan });
  }

  // Refuse a downgrade the current membership doesn't fit into.
  const limits = getLimits(plan);
  const usage = await getUsage(org._id);
  for (const key of ['staffSeats', 'students']) {
    if (limits[key] != null && usage[key] > limits[key]) {
      throw conflict(`This workspace has ${usage[key]} ${key === 'students' ? 'students' : 'staff members'}, more than the ${PLANS[plan].name} plan allows (${limits[key]}).`, { limit: key, used: usage[key], max: limits[key], plan });
    }
  }

  const from = org.plan;
  org.plan = plan;
  await org.save();
  await audit(req, 'plan.change', { targetType: 'Organization', targetId: org._id, meta: { from, to: plan } });
  await notifyRoles(org._id, ['owner'], {
    type: 'plan.changed',
    title: `Workspace plan changed to ${PLANS[plan].name}`,
    body: `${req.user.name} changed the plan from ${PLANS[from].name} to ${PLANS[plan].name}.`,
    link: '/app/settings/billing'
  });
  res.json({ workspace: await toWorkspaceDTO(org) });
}));

// GET /api/workspace/audit-log?page=&pageSize=&action=
router.get('/audit-log', adminOnly, asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pagination(req.query, { defaultSize: 25, maxSize: 100 });
  const filter = { organization: req.user.organization };
  if (req.query.action) filter.action = String(req.query.action).slice(0, 100);
  const [entries, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(pageSize)
      .populate('actor', 'name email').lean(),
    AuditLog.countDocuments(filter)
  ]);
  const items = entries.map((e) => ({
    id: String(e._id),
    action: e.action,
    targetType: e.targetType || null,
    targetId: e.targetId || null,
    meta: e.meta || null,
    ip: e.ip || null,
    createdAt: e.createdAt,
    actor: e.actor ? { id: String(e.actor._id), name: e.actor.name, email: e.actor.email } : null
  }));
  res.json({ items, total, page, pageSize });
}));

module.exports = router;
