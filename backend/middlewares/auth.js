/**
 * Authentication & authorization middleware.
 *
 *   const auth = require('../middlewares/auth');
 *   router.get('/x', auth.requireAuth, auth.requireRole(...auth.STAFF_ROLES), handler);
 *
 * Backward compatible with the legacy routes: the module itself is a callable
 * middleware (=== requireAuth) with requireRole / optionalAuth attached.
 *
 * req.user = { id, role, organization, name, email } (ids as strings). The
 * role and workspace come from the database (cached ~30 s), not the token, so
 * role changes and deactivation take effect quickly.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const { verifyAccessToken } = require('../services/tokens');
const { attachLegacyUser } = require('../services/workspace');
const { unauthenticated, accountDeactivated, forbidden, serviceUnavailable, asyncHandler } = require('../utils/errors');

const STAFF_ROLES = ['owner', 'admin', 'instructor'];
const ADMIN_ROLES = ['owner', 'admin'];

const CACHE_TTL_MS = 30 * 1000;
const CACHE_MAX = 5000;
const userCache = new Map(); // id -> { user, expires }

/** Drop a user from the auth cache (call after role change, deactivation, password change). */
function invalidateUserCache(userId) {
  if (userId) userCache.delete(String(userId));
}

function readToken(req) {
  const header = req.header('x-auth-token');
  if (header) return header.trim();
  const authz = req.header('authorization') || '';
  return /^Bearer\s+/i.test(authz) ? authz.replace(/^Bearer\s+/i, '').trim() : '';
}

async function loadUser(id) {
  const cached = userCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.user;

  let user = await User.findById(id)
    .select('name email role organization deactivated passwordChangedAt')
    .lean();
  if (user && !user.organization) {
    // Legacy account with a still-valid token: migrate it now.
    const doc = await User.findById(id);
    await attachLegacyUser(doc);
    user = { ...user, organization: doc.organization, role: doc.role };
  }
  if (user) {
    if (userCache.size >= CACHE_MAX) userCache.clear();
    userCache.set(id, { user, expires: Date.now() + CACHE_TTL_MS });
  }
  return user;
}

/** Rejects with 401 UNAUTHENTICATED unless a valid access token for an active user is sent. */
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw unauthenticated('Authentication required');

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    throw unauthenticated(err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token');
  }
  const id = decoded && decoded.user && decoded.user.id;
  if (!id || !mongoose.isValidObjectId(id)) throw unauthenticated('Invalid token');
  if (mongoose.connection.readyState !== 1) throw serviceUnavailable('Database is unavailable. Please try again shortly.');

  const user = await loadUser(String(id));
  if (!user) throw unauthenticated('Account not found');
  if (user.deactivated) throw accountDeactivated();
  // Tokens issued before the last password change are no longer valid.
  if (user.passwordChangedAt && decoded.iat * 1000 < new Date(user.passwordChangedAt).getTime()) {
    throw unauthenticated('Session expired');
  }

  req.user = {
    id: String(user._id),
    role: user.role,
    organization: String(user.organization),
    name: user.name,
    email: user.email
  };
  next();
});

/** Authenticates when a token is sent (invalid tokens still get 401); otherwise continues anonymously. */
const optionalAuth = (req, res, next) => (readToken(req) ? requireAuth(req, res, next) : next());

/**
 * 403 FORBIDDEN unless req.user.role is allowed. Roles follow the hierarchy
 * owner > admin > instructor: allowing 'instructor' also allows admin/owner,
 * and allowing 'admin' also allows owner. 'student' is matched exactly.
 */
function requireRole(...roles) {
  const allowed = new Set(roles.flat());
  if (allowed.has('instructor')) ['admin', 'owner'].forEach((r) => allowed.add(r));
  if (allowed.has('admin')) allowed.add('owner');
  return (req, res, next) => {
    if (!req.user) return next(unauthenticated());
    if (!allowed.has(req.user.role)) return next(forbidden(`This action requires the ${roles.flat().join(' or ')} role`));
    return next();
  };
}

/** Back-compat: the module is callable as a middleware. */
function auth(req, res, next) {
  return requireAuth(req, res, next);
}

Object.assign(auth, {
  requireAuth,
  requireRole,
  optionalAuth,
  invalidateUserCache,
  STAFF_ROLES,
  ADMIN_ROLES
});

module.exports = auth;
