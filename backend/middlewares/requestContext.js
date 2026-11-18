/**
 * Adds an `x-request-id` to every request/response and writes one structured
 * log line per request when it finishes. Never logs bodies, headers or tokens.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

const SAFE_ID = /^[A-Za-z0-9._-]{1,100}$/;

function requestContext(req, res, next) {
  const incoming = req.header('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const fields = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms * 10) / 10,
      userId: req.user ? req.user.id : undefined
    };
    if (res.statusCode >= 500) logger.error('request', fields);
    else logger.info('request', fields);
  });
  next();
}

module.exports = requestContext;
