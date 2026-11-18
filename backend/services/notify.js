/**
 * In-app notifications. Never throws: a failed notification must not fail the
 * action that triggered it.
 */
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * @param {string|string[]} userIds recipients
 * @param {{ type: string, title: string, body?: string, link?: string }} payload
 * @param {string} orgId workspace the notification belongs to
 * @returns {Promise<number>} number of notifications created
 */
async function notify(userIds, { type, title, body = '', link = '' }, orgId) {
  try {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
    if (!ids.length || !orgId || !type || !title) return 0;
    const docs = ids.map((user) => ({ organization: orgId, user, type, title, body, link }));
    const created = await Notification.insertMany(docs, { ordered: false });
    return created.length;
  } catch (err) {
    logger.warn('notify.failed', { err, type });
    return 0;
  }
}

/**
 * Notify every active member of `orgId` whose role is in `roles`.
 * @returns {Promise<number>}
 */
async function notifyRoles(orgId, roles, payload) {
  try {
    const users = await User.find({ organization: orgId, role: { $in: roles }, deactivated: { $ne: true } })
      .select('_id')
      .lean();
    return notify(users.map((u) => u._id), payload, orgId);
  } catch (err) {
    logger.warn('notify.roles_failed', { err, type: payload && payload.type });
    return 0;
  }
}

module.exports = { notify, notifyRoles };
