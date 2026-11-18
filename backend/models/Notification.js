const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');

const NINETY_DAYS = 90 * 24 * 60 * 60;

const NotificationSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // e.g. 'assessment.published', 'member.joined'
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 2000 },
    link: { type: String, default: '' }, // frontend route, e.g. /app/courses/:id
    readAt: { type: Date, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ organization: 1, user: 1, readAt: 1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS });

NotificationSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
