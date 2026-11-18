const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');

const ONE_YEAR = 365 * 24 * 60 * 60;

/** Who did what, when — for workspace admins. Written via services/audit.js. */
const AuditLogSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // 'course.create', 'member.role_change', ...
    targetType: { type: String },
    targetId: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ organization: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ONE_YEAR });

AuditLogSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
