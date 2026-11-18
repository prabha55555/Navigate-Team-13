/**
 * Auth routes (docs/ARCHITECTURE.md §5 "Auth").
 */
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Invite = require('../models/Invite');
const { requireAuth, invalidateUserCache } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimits');
const { asyncHandler, AppError, accountDeactivated, badRequest, conflict, notFound, unauthenticated, serviceUnavailable } = require('../utils/errors');
const { requireFields, isEmail, normalizeEmail, oneOf, str, assertPassword } = require('../utils/validate');
const tokens = require('../services/tokens');
const { assertSeatAvailable } = require('../services/plans');
const { notifyRoles } = require('../services/notify');
const { audit } = require('../services/audit');
const { sendMail } = require('../services/mailer');
const { toWorkspaceDTO, uniqueSlug, attachLegacyUser } = require('../services/workspace');
const env = require('../config/env');

const router = express.Router();

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const toUserDTO = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  avatarColor: user.avatarColor,
  preferences: { theme: (user.preferences && user.preferences.theme) || 'system' },
  organization: user.organization ? String(user.organization._id || user.organization) : null,
  createdAt: user.createdAt
});

/** Standard sign-in payload: tokens + user + workspace. */
async function sessionPayload(user) {
  const org = await Organization.findById(user.organization);
  return { ...tokens.issueTokens(user), user: toUserDTO(user), workspace: await toWorkspaceDTO(org) };
}

const requireDb = (req, res, next) =>
  next(mongoose.connection.readyState === 1 ? undefined : serviceUnavailable('Database is unavailable. Please try again shortly.'));

router.use(requireDb);

/**
 * Resolves a join code: an Invite code, or a course join code (Course model is
 * owned by the learning module and looked up lazily).
 * @returns {Promise<{ kind: 'invite', invite, org } | { kind: 'course', course, org } | null>}
 */
async function resolveJoinCode(rawCode) {
  const code = String(rawCode || '').trim();
  if (!code || code.length > 64) return null;

  const invite = await Invite.findOne({ code });
  if (invite) {
    const org = await Organization.findById(invite.organization);
    return org ? { kind: 'invite', invite, org } : null;
  }

  const Course = mongoose.models.Course;
  if (Course && Course.schema.path('joinCode')) {
    const course = await Course.findOne({ joinCode: code.toUpperCase() });
    if (course) {
      const org = await Organization.findById(course.organization);
      return org ? { kind: 'course', course, org } : null;
    }
  }
  return null;
}

/** Throws 400 when a resolved course code can't be used for self sign-up. */
function assertCourseJoinable({ course, org }) {
  if (course.archived || course.joinCodeEnabled === false) {
    throw badRequest('This course is not accepting new students', { field: 'code' });
  }
  if (org.settings && org.settings.allowStudentSelfSignup === false) {
    throw badRequest('This workspace does not allow student self sign-up', { field: 'code' });
  }
}

async function enrollInCourse(course, user) {
  const Enrollment = mongoose.models.Enrollment;
  if (!Enrollment) return;
  await Enrollment.updateOne(
    { course: course._id, student: user._id },
    { $setOnInsert: { organization: course.organization, course: course._id, student: user._id, enrolledAt: new Date() }, $set: { status: 'active' } },
    { upsert: true }
  );
}

// POST /api/auth/register
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const body = req.body || {};
  requireFields(body, ['name', 'email', 'password', 'mode']);
  const name = str(body.name, { field: 'name', max: 120, required: true });
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) throw badRequest('Please enter a valid email address', { field: 'email' });
  assertPassword(body.password);
  const mode = oneOf(body.mode, ['create-workspace', 'join'], 'mode');

  if (await User.exists({ email })) {
    throw conflict('An account with this email already exists. Sign in instead.', { field: 'email' });
  }

  let user;
  let org;
  if (mode === 'create-workspace') {
    const workspaceName = str(body.workspaceName, { field: 'workspaceName', max: 120, required: true });
    org = await Organization.create({ name: workspaceName, slug: await uniqueSlug(workspaceName) });
    try {
      user = await User.create({ organization: org._id, name, email, password: body.password, role: 'owner' });
    } catch (err) {
      await Organization.deleteOne({ _id: org._id });
      throw err;
    }
    org.createdBy = user._id;
    await org.save();
    await audit(req, 'workspace.create', { organization: org._id, actor: user._id, targetType: 'Organization', targetId: org._id });
  } else {
    requireFields(body, ['code']);
    const resolved = await resolveJoinCode(body.code);
    if (!resolved) throw notFound('This invite or join code is not valid');
    org = resolved.org;

    if (resolved.kind === 'invite') {
      const reason = resolved.invite.unusableReason();
      if (reason) throw badRequest(reason, { field: 'code' });
      const { role } = resolved.invite;
      await assertSeatAvailable(org._id, role);
      // Claim one use atomically so a limited invite can't be over-used concurrently.
      const claimed = await Invite.findOneAndUpdate(
        {
          _id: resolved.invite._id,
          revoked: false,
          $or: [{ maxUses: null }, { $expr: { $lt: ['$uses', '$maxUses'] } }]
        },
        { $inc: { uses: 1 } }
      );
      if (!claimed) throw badRequest('This invite link has reached its usage limit', { field: 'code' });
      try {
        user = await User.create({ organization: org._id, name, email, password: body.password, role });
      } catch (err) {
        await Invite.updateOne({ _id: claimed._id }, { $inc: { uses: -1 } });
        throw err;
      }
    } else {
      assertCourseJoinable(resolved);
      await assertSeatAvailable(org._id, 'student');
      user = await User.create({ organization: org._id, name, email, password: body.password, role: 'student' });
      await enrollInCourse(resolved.course, user);
    }

    await audit(req, 'member.join', {
      organization: org._id,
      actor: user._id,
      targetType: 'User',
      targetId: user._id,
      meta: { role: user.role, via: resolved.kind }
    });
    await notifyRoles(org._id, ['owner', 'admin'], {
      type: 'member.joined',
      title: `${user.name} joined the workspace`,
      body: `${user.name} (${user.email}) joined as ${user.role}.`,
      link: '/app/settings/members'
    });
  }

  user.lastLoginAt = new Date();
  await user.save();
  res.status(201).json(await sessionPayload(user));
}));

// POST /api/auth/login
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = req.body && req.body.password;
  if (!email || typeof password !== 'string' || !password) throw badRequest('Email and password are required');

  const user = await User.findOne({ email });
  if (!user) throw unauthenticated('Invalid email or password');

  if (user.isLocked()) {
    const retryAfterSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
    throw new AppError(429, 'RATE_LIMITED', 'Too many failed sign-in attempts. Try again in a few minutes or reset your password.', { retryAfterSeconds });
  }

  if (!(await user.comparePassword(password))) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update = attempts >= MAX_FAILED_LOGINS
      ? { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MS) } }
      : { $set: { failedLoginAttempts: attempts } };
    await User.updateOne({ _id: user._id }, update);
    throw unauthenticated('Invalid email or password');
  }
  if (user.deactivated) throw accountDeactivated();

  if (!user.organization) await attachLegacyUser(user);
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  res.json(await sessionPayload(user));
}));

// POST /api/auth/refresh-token
router.post('/refresh-token', asyncHandler(async (req, res) => {
  const decoded = tokens.verifyRefreshToken(req.body && req.body.refreshToken);
  if (!decoded) throw unauthenticated('Invalid refresh token');
  const user = await User.findById(decoded.user.id);
  if (!user) throw unauthenticated('Invalid refresh token');
  if (user.deactivated) throw accountDeactivated();
  if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
    throw unauthenticated('Session expired');
  }
  res.json({ token: tokens.signAccessToken(user) });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  tokens.revokeRefreshToken(req.body && req.body.refreshToken);
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw unauthenticated('Account not found');
  const org = await Organization.findById(user.organization);
  res.json({ user: toUserDTO(user), workspace: await toWorkspaceDTO(org) });
}));

// PATCH /api/auth/me
router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user) throw unauthenticated('Account not found');
  if (body.name !== undefined) user.name = str(body.name, { field: 'name', max: 120, required: true });
  if (body.preferences && body.preferences.theme !== undefined) {
    user.preferences.theme = oneOf(body.preferences.theme, ['light', 'dark', 'system'], 'preferences.theme');
  }
  await user.save();
  invalidateUserCache(user._id);
  res.json({ user: toUserDTO(user) });
}));

/** Marks all existing sessions as stale (tokens issued before now are rejected). */
const markPasswordChanged = (user) => {
  // 1 s back-dated so a token issued in the same second (JWT iat is in seconds) stays valid.
  user.passwordChangedAt = new Date(Date.now() - 1000);
};

// POST /api/auth/change-password
router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  requireFields(body, ['currentPassword', 'newPassword']);
  const user = await User.findById(req.user.id);
  if (!user) throw unauthenticated('Account not found');
  if (!(await user.comparePassword(body.currentPassword))) {
    throw badRequest('Your current password is incorrect', { field: 'currentPassword' });
  }
  assertPassword(body.newPassword, 'newPassword');
  user.password = body.newPassword;
  markPasswordChanged(user);
  await user.save();
  invalidateUserCache(user._id);
  await audit(req, 'user.password_change', { targetType: 'User', targetId: user._id });
  // Other sessions are signed out; this one gets fresh tokens.
  res.json({ message: 'Password updated', ...tokens.issueTokens(user) });
}));

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const response = { message: 'If an account exists for that email, a password reset link has been sent.' };
  const user = isEmail(email) ? await User.findOne({ email, deactivated: { $ne: true } }) : null;
  if (user) {
    const { token, hash } = tokens.createResetToken();
    user.passwordResetTokenHash = hash;
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();
    const url = `${env.appUrl()}/reset-password/${token}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your Navigate password',
      text: `Hi ${user.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you didn't ask for this, you can ignore this email.`
    });
    if (!env.isProduction()) response.devResetUrl = url;
  }
  res.json(response);
}));

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const body = req.body || {};
  requireFields(body, ['token', 'password']);
  const user = await User.findOne({
    passwordResetTokenHash: tokens.hashToken(body.token),
    passwordResetExpires: { $gt: new Date() }
  });
  if (!user) throw badRequest('This reset link is invalid or has expired. Request a new one.', { field: 'token' });
  assertPassword(body.password);
  user.password = body.password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  markPasswordChanged(user);
  await user.save();
  invalidateUserCache(user._id);
  await audit(req, 'user.password_reset', { organization: user.organization, actor: user._id, targetType: 'User', targetId: user._id });
  res.json({ message: 'Your password has been reset. You can now sign in.' });
}));

// GET /api/auth/invite/:code — preview before sign-up
router.get('/invite/:code', asyncHandler(async (req, res) => {
  const resolved = await resolveJoinCode(req.params.code);
  if (!resolved) throw notFound('This invite or join code is not valid');
  if (resolved.kind === 'invite') {
    const reason = resolved.invite.unusableReason();
    if (reason) throw badRequest(reason, { field: 'code' });
    return res.json({ workspace: { name: resolved.org.name }, role: resolved.invite.role, kind: 'invite' });
  }
  assertCourseJoinable(resolved);
  return res.json({
    workspace: { name: resolved.org.name },
    role: 'student',
    kind: 'course',
    course: { title: resolved.course.title }
  });
}));

module.exports = router;
module.exports.toUserDTO = toUserDTO;
