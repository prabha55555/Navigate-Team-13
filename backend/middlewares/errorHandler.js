/**
 * Central error rendering: every error becomes
 *   { message, error: { code, message, details? } }
 */
const mongoose = require('mongoose');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');
const env = require('../config/env');

/** Maps known error types to an AppError. Unknown errors become 500 INTERNAL. */
function toAppError(err) {
  if (err instanceof AppError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, e]) => [k, e.message]));
    return new AppError(400, 'VALIDATION_ERROR', Object.values(fields)[0] || 'Invalid data', { fields });
  }
  if (err instanceof mongoose.Error.CastError) return new AppError(404, 'NOT_FOUND', 'Not found');
  if (err && err.code === 11000) {
    const fields = Object.keys(err.keyValue || err.keyPattern || {});
    return new AppError(409, 'CONFLICT', fields.length ? `${fields.join(', ')} already exists` : 'Already exists', { fields });
  }
  if (err && err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return new AppError(400, 'VALIDATION_ERROR', message, { field: err.field });
  }
  if (err && err.type === 'entity.parse.failed') return new AppError(400, 'VALIDATION_ERROR', 'Malformed JSON in request body');
  if (err && err.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');

  const status = (err && (err.status || err.statusCode)) || 500;
  if (status < 500) return new AppError(status, 'BAD_REQUEST', err.message || 'Bad request');
  return new AppError(500, 'INTERNAL', 'Something went wrong. Please try again.');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const appErr = toAppError(err);
  if (appErr.status >= 500) {
    logger.error('request.error', { requestId: req.id, path: req.originalUrl.split('?')[0], err });
  }
  if (res.headersSent) return;
  const body = { message: appErr.message, error: { code: appErr.code, message: appErr.message } };
  if (appErr.details !== undefined) body.error.details = appErr.details;
  if (appErr.status >= 500 && !env.isProduction() && err && err.message) body.error.debug = err.message;
  res.status(appErr.status).json(body);
}

/** JSON 404 for unknown /api routes. */
function apiNotFound(req, res) {
  const message = `API route not found: ${req.method} ${req.originalUrl.split('?')[0]}`;
  res.status(404).json({ message, error: { code: 'NOT_FOUND', message } });
}

module.exports = { errorHandler, apiNotFound, toAppError };
