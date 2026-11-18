/**
 * Rate limits (docs/ARCHITECTURE.md §6). Limits are configurable through env
 * so tests and load-tests can tune them:
 *   RATE_LIMIT_AUTH_MAX     (default 20 per 15 min per IP)  login/register/forgot/reset
 *   RATE_LIMIT_GENERAL_MAX  (default 600 per 15 min per IP) all /api routes
 *   RATE_LIMIT_AI_MAX       (default 20 per minute per user) AI endpoints
 * Counters are in-memory (per process); use a shared store when running several instances.
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { intEnv } = require('../config/env');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const handler = (req, res, next, options) => {
  const message = typeof options.message === 'string' ? options.message : 'Too many requests, please try again later';
  res.status(options.statusCode).json({ message, error: { code: 'RATE_LIMITED', message } });
};

const common = { standardHeaders: 'draft-7', legacyHeaders: false, handler };

const authLimiter = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: intEnv('RATE_LIMIT_AUTH_MAX', 20),
  message: 'Too many attempts. Please wait a few minutes and try again.'
});

const generalLimiter = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: intEnv('RATE_LIMIT_GENERAL_MAX', 600)
});

/** Use after requireAuth: keyed by user id (falls back to IP). */
const aiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: intEnv('RATE_LIMIT_AI_MAX', 20),
  message: 'You are generating too quickly. Please wait a minute and try again.',
  keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip))
});

module.exports = { authLimiter, generalLimiter, aiLimiter };
