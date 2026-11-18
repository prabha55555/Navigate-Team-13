/**
 * In-app notifications for the signed-in user (docs/ARCHITECTURE.md §5).
 */
const express = require('express');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middlewares/auth');
const { asyncHandler, notFound } = require('../utils/errors');
const { assertObjectId } = require('../utils/validate');
const { serialize } = require('../utils/serialize');

const router = express.Router();
router.use(requireAuth);

const MAX_ITEMS = 50;

const mine = (req) => ({ user: req.user.id, organization: req.user.organization });

// GET /api/notifications?unread=true → { items, unreadCount }
router.get('/', asyncHandler(async (req, res) => {
  const filter = mine(req);
  if (req.query.unread === 'true') filter.readAt = null;
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(MAX_ITEMS).lean(),
    Notification.countDocuments({ ...mine(req), readAt: null })
  ]);
  res.json({ items: serialize(items, { hide: ['organization', 'user'] }), unreadCount });
}));

// POST /api/notifications/read-all
router.post('/read-all', asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ ...mine(req), readAt: null }, { $set: { readAt: new Date() } });
  res.json({ updated: result.modifiedCount, unreadCount: 0 });
}));

// POST /api/notifications/:id/read
router.post('/:id/read', asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Notification');
  const notification = await Notification.findOne({ _id: req.params.id, ...mine(req) });
  if (!notification) throw notFound('Notification not found');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  const unreadCount = await Notification.countDocuments({ ...mine(req), readAt: null });
  res.json({ notification: serialize(notification, { hide: ['organization', 'user'] }), unreadCount });
}));

module.exports = router;
