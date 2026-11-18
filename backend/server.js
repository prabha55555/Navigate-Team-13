require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const env = require('./config/env');
const logger = require('./utils/logger');
const requestContext = require('./middlewares/requestContext');
const { generalLimiter } = require('./middlewares/rateLimits');
const { errorHandler, apiNotFound } = require('./middlewares/errorHandler');

const app = express();

// Behind a load balancer set TRUST_PROXY to the number of proxy hops (or 'true', or an
// Express trust value such as 'loopback') so req.ip (used by rate limits and audit logs)
// is the client's address rather than the proxy's.
function trustProxySetting(value) {
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
if (process.env.TRUST_PROXY) app.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY.trim()));
app.disable('x-powered-by');
// API responses are per-user and change often: no ETags (a stale 304 would surface as an error in the client) and no caching.
app.set('etag', false);

app.use(requestContext);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = new Set(env.corsOrigins());
app.use(cors({
  // Requests without an Origin (curl, server-to-server, same-origin) are allowed;
  // browsers from other origins simply get no CORS headers.
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  exposedHeaders: ['x-request-id', 'RateLimit', 'RateLimit-Policy', 'Retry-After']
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Liveness / readiness (not rate limited, for load balancers)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});
app.get('/api/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', database: ready ? 'connected' : 'disconnected' });
});

app.use('/api', generalLimiter);

// Platform
app.use('/api/auth', require('./api/auth'));
app.use('/api/workspace', require('./api/workspace'));
app.use('/api/notifications', require('./api/notifications'));

// Learning
app.use('/api/courses', require('./api/courses'));
app.use('/api/assessments', require('./api/assessments'));
app.use('/api/submissions', require('./api/submissions'));
app.use('/api/analytics', require('./api/analytics'));
app.use('/api/learning-path', require('./api/learningPath'));
app.use('/api/question-bank', require('./api/questionBank'));

// AI authoring tools (syllabus analysis, question generation, templates)
app.use('/api/assessment', require('./api/assessment'));

app.use('/api', apiNotFound);

if (env.isProduction()) {
  const buildDir = path.join(__dirname, '../frontend/build');
  app.use(express.static(buildDir));
  app.get('*', (req, res) => res.sendFile(path.join(buildDir, 'index.html')));
}

app.use(errorHandler);

const MONGO_OPTIONS = { serverSelectionTimeoutMS: 5000 };
const redactUri = (uri) => String(uri || '').replace(/\/\/[^@/]*@/, '//***@');

/**
 * Connects Mongoose. With an explicit `uri` (tests) it connects only there.
 * Otherwise it tries MONGO_URI and, outside production, falls back to
 * MONGO_URI_FALLBACK (default local MongoDB).
 * @returns {Promise<boolean>} whether a connection was established
 */
async function connectDB(uri) {
  const candidates = uri
    ? [uri]
    : [process.env.MONGO_URI, env.isProduction() ? null : (process.env.MONGO_URI_FALLBACK || 'mongodb://127.0.0.1:27017/navigate')]
      .filter(Boolean);
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await mongoose.connect(candidate, MONGO_OPTIONS);
      logger.info('db.connected', { uri: redactUri(candidate) });
      return true;
    } catch (err) {
      logger.warn('db.connect_failed', { uri: redactUri(candidate), err });
      // eslint-disable-next-line no-await-in-loop
      await mongoose.disconnect().catch(() => {});
    }
  }
  return false;
}

/** Boots the HTTP server (only when run directly: `node server.js`). */
async function start() {
  env.checkEnv().forEach((warning) => logger.warn('config.warning', { warning }));

  const connected = await connectDB();
  if (!connected) logger.error('db.unavailable', { msg: 'Starting without a database; /api/ready will report not-ready' });

  const port = parseInt(process.env.PORT, 10) || 5000;
  const server = app.listen(port, () => logger.info('server.listening', { port, env: process.env.NODE_ENV || 'development' }));

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server.shutdown', { signal });
    setTimeout(() => process.exit(1), 10000).unref(); // hard stop if draining hangs
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', { err: reason instanceof Error ? reason : new Error(String(reason)) });
  });
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    logger.error('server.start_failed', { err });
    process.exit(1);
  });
}

module.exports = { app, connectDB, start };
