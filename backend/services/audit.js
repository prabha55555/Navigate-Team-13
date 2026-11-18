/**
 * Audit trail. Never throws: auditing must not fail the action being audited.
 */
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Client IP for the audit trail: req.ip (which honours `trust proxy`, see
 * TRUST_PROXY in server.js), falling back to the socket address, with
 * IPv4-mapped / loopback IPv6 forms normalised ('::ffff:10.0.0.5' → '10.0.0.5', '::1' → '127.0.0.1').
 */
function clientIp(req) {
  const raw = (req && (req.ip || (req.socket && req.socket.remoteAddress))) || '';
  if (!raw) return undefined;
  if (raw === '::1') return '127.0.0.1';
  const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  return mapped ? mapped[1] : raw;
}

/**
 * Record `action` performed by the authenticated caller.
 * @param {import('express').Request} req  uses req.user.{id, organization} and req.ip
 * @param {string} action e.g. 'course.create', 'member.role_change'
 * @param {{ targetType?: string, targetId?: any, meta?: object,
 *           organization?: string, actor?: string }} [opts]
 *        `organization`/`actor` override req.user (e.g. during sign-up, before req.user exists)
 */
async function audit(req, action, { targetType, targetId, meta, organization, actor } = {}) {
  try {
    const user = (req && req.user) || {};
    const org = organization || user.organization;
    if (!org) return null;
    return await AuditLog.create({
      organization: org,
      actor: actor || user.id,
      action,
      targetType,
      targetId: targetId != null ? String(targetId) : undefined,
      meta,
      ip: clientIp(req)
    });
  } catch (err) {
    logger.warn('audit.failed', { err, action });
    return null;
  }
}

module.exports = { audit, clientIp };
