/**
 * Outgoing email. No email provider is wired up yet, so messages are written
 * to the structured log (full text outside production, metadata only in
 * production). Swap the body of `sendMail` for an SMTP/API transport later;
 * callers don't need to change.
 */
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * @param {{ to: string, subject: string, text: string }} message
 * @returns {Promise<{ delivered: boolean }>}
 */
async function sendMail({ to, subject, text }) {
  if (env.isProduction()) {
    logger.warn('mail.not_configured', { to, subject });
  } else {
    logger.info('mail.dev', { to, subject, text });
  }
  return { delivered: false };
}

module.exports = { sendMail };
