const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { toJSONPlugin } = require('../utils/serialize');

const ROLES = ['owner', 'admin', 'instructor', 'student'];
const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#2563eb'];

const UserSchema = new mongoose.Schema(
  {
    // Optional only so legacy accounts can still load; they are attached to a
    // "Default Workspace" on first login (see api/auth.js).
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'student' },
    avatarColor: {
      type: String,
      default: () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
    },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' }
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    passwordResetTokenHash: { type: String },
    passwordResetExpires: { type: Date },
    // Tokens issued before this instant are rejected (set on password change/reset).
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    deactivated: { type: Boolean, default: false }
  },
  { timestamps: true }
);

UserSchema.index({ organization: 1, role: 1 });

UserSchema.plugin(toJSONPlugin, {
  hide: ['password', 'passwordResetTokenHash', 'passwordResetExpires', 'failedLoginAttempts', 'lockUntil', 'passwordChangedAt']
});

// Hash password before saving
UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    return next();
  } catch (error) {
    return next(error);
  }
});

UserSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(String(candidatePassword || ''), this.password);
};

UserSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

UserSchema.statics.ROLES = ROLES;

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
