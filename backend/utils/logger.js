/**
 * Minimal structured JSON logger (one JSON object per line on stdout/stderr).
 * Silent under Jest unless LOG_LEVEL is set, so test output stays readable.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const configuredLevel = () => {
  if (process.env.LOG_LEVEL && LEVELS[process.env.LOG_LEVEL]) return LEVELS[process.env.LOG_LEVEL];
  if (process.env.JEST_WORKER_ID) return LEVELS.silent;
  return LEVELS.info;
};

function write(level, msg, fields = {}) {
  if (LEVELS[level] < configuredLevel()) return;
  const entry = { level, time: new Date().toISOString(), msg, ...fields };
  if (fields.err instanceof Error) {
    entry.err = { message: fields.err.message, name: fields.err.name };
    if (process.env.NODE_ENV !== 'production') entry.err.stack = fields.err.stack;
  }
  const line = JSON.stringify(entry);
  if (LEVELS[level] >= LEVELS.warn) process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

module.exports = {
  debug: (msg, fields) => write('debug', msg, fields),
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields)
};
