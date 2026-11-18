/**
 * JWT access/refresh tokens and random codes.
 *
 * Access tokens live 15 minutes, refresh tokens 7 days. Both are stateless
 * (signature + expiry) so they survive restarts; logged-out refresh tokens are
 * remembered in memory until they would have expired anyway.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const revokedRefreshTokens = new Set();

/** JWT payload for a user document: { user: { id, role, org } }. */
const payloadFor = (user) => ({
  user: {
    id: String(user._id || user.id),
    role: user.role,
    org: user.organization ? String(user.organization._id || user.organization) : undefined
  }
});

const signAccessToken = (user) => jwt.sign(payloadFor(user), env.jwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
const signRefreshToken = (user) =>
  jwt.sign({ ...payloadFor(user), typ: 'refresh' }, env.refreshSecret(), { expiresIn: REFRESH_TOKEN_EXPIRY });

/** @returns {{ token: string, refreshToken: string }} */
const issueTokens = (user) => ({ token: signAccessToken(user), refreshToken: signRefreshToken(user) });

/** Verifies an access token; throws (jsonwebtoken error) when invalid/expired. */
const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret());

/** Verifies a refresh token; returns the decoded payload or null when invalid/revoked. */
function verifyRefreshToken(token) {
  if (typeof token !== 'string' || !token || revokedRefreshTokens.has(token)) return null;
  try {
    const decoded = jwt.verify(token, env.refreshSecret());
    return decoded && decoded.user && decoded.user.id ? decoded : null;
  } catch (err) {
    return null;
  }
}

/** Revokes a refresh token until its natural expiry. */
function revokeRefreshToken(token) {
  if (typeof token !== 'string' || !token) return;
  revokedRefreshTokens.add(token);
  const decoded = jwt.decode(token);
  const ttl = decoded && decoded.exp ? Math.max(0, decoded.exp * 1000 - Date.now()) : 0;
  setTimeout(() => revokedRefreshTokens.delete(token), ttl).unref();
}

const URL_SAFE = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Cryptographically random code from `alphabet` (default: URL-safe, no look-alike chars). */
function randomCode(length = 12, alphabet = URL_SAFE) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** A single-use secret for password resets: send `token`, store only `hash`. */
function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

module.exports = {
  issueTokens,
  signAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  randomCode,
  hashToken,
  createResetToken
};
