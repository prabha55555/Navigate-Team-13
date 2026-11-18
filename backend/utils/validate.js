/**
 * Tiny dependency-free validation helpers. Each throws badRequest (400
 * VALIDATION_ERROR) with a `details.field` so the UI can highlight the input.
 */
const mongoose = require('mongoose');
const { badRequest, notFound } = require('./errors');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Throws if any of `fields` is missing/blank in `body`. */
function requireFields(body, fields) {
  const missing = fields.filter((f) => isBlank(body && body[f]));
  if (missing.length) {
    throw badRequest(`Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`, {
      fields: missing
    });
  }
}

/** True when `value` looks like an email address. */
const isEmail = (value) => typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value.trim());

/** Lower-cased, trimmed email, or '' when not a string. */
const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** Throws unless `value` is one of `allowed`; returns the value. */
function oneOf(value, allowed, field = 'value') {
  if (!allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`, { field, allowed });
  }
  return value;
}

/** Parses `value` as an integer clamped to [min, max]; falls back to `fallback` when not numeric. */
function clampInt(value, min, max, fallback = min) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Trimmed string limited to `max` chars; throws if required and empty. */
function str(value, { field = 'value', max = 500, required = false } = {}) {
  if (isBlank(value)) {
    if (required) throw badRequest(`${field} is required`, { field });
    return undefined;
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be text`, { field });
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${field} must be at most ${max} characters`, { field, max });
  return trimmed;
}

/** Password policy for new passwords: >= 8 chars, at least one letter and one digit. */
function assertPassword(password, field = 'password') {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128
      || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw badRequest('Password must be at least 8 characters and include a letter and a number', { field });
  }
}

/** Throws 404 when `id` is not a valid ObjectId (a malformed id can never match a resource). */
function assertObjectId(id, what = 'Resource') {
  if (!mongoose.isValidObjectId(id)) throw notFound(`${what} not found`);
  return id;
}

/** Standard list query parsing: ?page=&pageSize= → { page, pageSize, skip }. */
function pagination(query = {}, { defaultSize = 20, maxSize = 100 } = {}) {
  const page = clampInt(query.page, 1, 100000, 1);
  const pageSize = clampInt(query.pageSize, 1, maxSize, defaultSize);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** Escapes a user string for use inside a RegExp (for ?q= search). */
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  requireFields,
  isEmail,
  normalizeEmail,
  oneOf,
  clampInt,
  str,
  assertPassword,
  assertObjectId,
  pagination,
  escapeRegex
};
