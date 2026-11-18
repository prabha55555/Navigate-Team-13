const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');
const { PLAN_IDS } = require('../config/plans');

/** A workspace: one paying customer. Every other document belongs to exactly one. */
const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: { type: String, enum: PLAN_IDS, default: 'free' },
    branding: {
      primaryColor: { type: String, default: '#4f46e5' },
      logoUrl: { type: String, default: '' }
    },
    settings: {
      allowStudentSelfSignup: { type: Boolean, default: true }
    },
    // Monthly AI usage counter; reset lazily when `period` != current 'YYYY-MM'.
    usage: {
      period: { type: String, default: '' },
      aiGenerations: { type: Number, default: 0 },
      // Period in which owners were already told the AI quota ran out (notify once).
      aiLimitNotifiedPeriod: { type: String, default: '' }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

OrganizationSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);
