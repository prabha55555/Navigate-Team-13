const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');

/** A shareable link that lets people join a workspace with a preset role. */
const InviteSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    code: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'instructor', 'student'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date },
    maxUses: { type: Number, default: null }, // null = unlimited
    uses: { type: Number, default: 0 },
    revoked: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InviteSchema.index({ organization: 1, createdAt: -1 });

/** Why an invite can't be used right now, or null if it's usable. */
InviteSchema.methods.unusableReason = function unusableReason(now = new Date()) {
  if (this.revoked) return 'This invite link has been revoked';
  if (this.expiresAt && this.expiresAt <= now) return 'This invite link has expired';
  if (this.maxUses != null && this.uses >= this.maxUses) return 'This invite link has reached its usage limit';
  return null;
};

InviteSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.Invite || mongoose.model('Invite', InviteSchema);
