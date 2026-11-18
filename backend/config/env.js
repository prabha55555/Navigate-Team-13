/**
 * Central access to environment configuration plus boot-time checks.
 * In production the server refuses to start with an unsafe configuration;
 * in development it warns and uses safe local defaults.
 */
const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';

const isProduction = () => process.env.NODE_ENV === 'production';
const isTest = () => process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);

const jwtSecret = () => process.env.JWT_SECRET || DEV_JWT_SECRET;
const refreshSecret = () => process.env.REFRESH_TOKEN_SECRET || `${jwtSecret()}_refresh`;
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const corsOrigins = () =>
  (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean);
/** 'demo' changes plans instantly; anything else requires contacting sales. */
const billingMode = () => process.env.BILLING_MODE || (isProduction() ? 'contact-sales' : 'demo');
const intEnv = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isNaN(n) ? fallback : n;
};

/**
 * Validates configuration. Returns a list of warnings; throws in production
 * when a required setting is missing or unsafe.
 */
function checkEnv() {
  const problems = [];
  const secret = process.env.JWT_SECRET || '';
  // Reject the documented placeholders too: they are long enough to pass the
  // length check but are public, so tokens signed with them can be forged.
  const looksLikePlaceholder = /replace|change[-_ ]?me|example|placeholder|your[-_ ]/i.test(secret);
  if (secret.length < 32 || looksLikePlaceholder || secret === DEV_JWT_SECRET) {
    problems.push('JWT_SECRET must be set to a random string of at least 32 characters (not the example value)');
  }
  if (!process.env.MONGO_URI) problems.push('MONGO_URI must be set');
  if (isProduction() && problems.length) {
    throw new Error(`Refusing to start in production: ${problems.join('; ')}`);
  }
  return problems;
}

module.exports = {
  isProduction,
  isTest,
  jwtSecret,
  refreshSecret,
  appUrl,
  corsOrigins,
  billingMode,
  intEnv,
  checkEnv
};
