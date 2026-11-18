/**
 * Application errors. Throw an AppError (or use a helper) from any route or
 * service; the central error middleware in server.js renders it as
 *   { message, error: { code, message, details } }
 */
class AppError extends Error {
  /**
   * @param {number} status  HTTP status code
   * @param {string} code    SNAKE_CASE machine-readable code
   * @param {string} message human-readable message
   * @param {object} [details] extra structured data for the client
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const badRequest = (message = 'Invalid request', details) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
const unauthenticated = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHENTICATED', message);
/** 401 for a deactivated account, distinct from an expired session so the UI can say so. */
const accountDeactivated = (message = 'This account has been deactivated. Contact your workspace admin.') =>
  new AppError(401, 'ACCOUNT_DEACTIVATED', message);
const forbidden = (message = 'You do not have permission to do this') =>
  new AppError(403, 'FORBIDDEN', message);
const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
const conflict = (message = 'Conflict', details) => new AppError(409, 'CONFLICT', message, details);
const tooManyRequests = (message = 'Too many requests, please try again later') =>
  new AppError(429, 'RATE_LIMITED', message);
const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);

/**
 * 402 PLAN_LIMIT. details = { limit, used, max, plan }
 */
const planLimit = (details = {}, message) =>
  new AppError(
    402,
    'PLAN_LIMIT',
    message || `Your workspace has reached its ${details.limit || 'plan'} limit. Upgrade your plan to continue.`,
    details
  );

/**
 * Wraps an async route handler so rejected promises reach the error middleware.
 * Express 4 does not do this on its own.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  badRequest,
  unauthenticated,
  accountDeactivated,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  serviceUnavailable,
  planLimit,
  asyncHandler
};
