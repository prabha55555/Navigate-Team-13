/**
 * Plan limits and usage metering (see docs/ARCHITECTURE.md §4).
 */
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { PLANS } = require('../config/plans');
const { planLimit, notFound, unauthenticated, asyncHandler } = require('../utils/errors');
const { notifyRoles } = require('./notify');

const STAFF = ['owner', 'admin', 'instructor'];

/** Limits for a plan id ({ staffSeats, students, aiGenerations }; null = unlimited). */
const getLimits = (plan) => ({ ...(PLANS[plan] || PLANS.free).limits });

/** Current usage period, 'YYYY-MM' (UTC). */
const currentPeriod = (date = new Date()) => date.toISOString().slice(0, 7);

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/** @returns {Promise<{ staffSeats: number, students: number, aiGenerations: number }>} */
async function getUsage(orgId) {
  const [org, counts] = await Promise.all([
    Organization.findById(orgId).select('usage').lean(),
    User.aggregate([
      { $match: { organization: toObjectId(orgId), deactivated: { $ne: true } } },
      { $group: { _id: '$role', n: { $sum: 1 } } }
    ])
  ]);
  const byRole = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const ai = org && org.usage && org.usage.period === currentPeriod() ? org.usage.aiGenerations || 0 : 0;
  return {
    staffSeats: STAFF.reduce((sum, r) => sum + (byRole[r] || 0), 0),
    students: byRole.student || 0,
    aiGenerations: ai
  };
}

/**
 * Throws 402 PLAN_LIMIT when adding one more member with `role` would exceed
 * the workspace's plan.
 */
async function assertSeatAvailable(orgId, role) {
  const org = await Organization.findById(orgId).select('plan').lean();
  if (!org) throw notFound('Workspace not found');
  const limits = getLimits(org.plan);
  const limitKey = role === 'student' ? 'students' : 'staffSeats';
  const max = limits[limitKey];
  if (max == null) return;
  const usage = await getUsage(orgId);
  if (usage[limitKey] + 1 > max) {
    throw planLimit({ limit: limitKey, used: usage[limitKey], max, plan: org.plan });
  }
}

async function notifyAiLimitOnce(orgId, period) {
  const claimed = await Organization.findOneAndUpdate(
    { _id: orgId, 'usage.aiLimitNotifiedPeriod': { $ne: period } },
    { $set: { 'usage.aiLimitNotifiedPeriod': period } }
  ).lean();
  if (claimed) {
    await notifyRoles(orgId, ['owner'], {
      type: 'plan.limit_reached',
      title: 'AI generation limit reached',
      body: 'Your workspace has used all AI generations included in its plan this month. Upgrade to keep generating.',
      link: '/app/settings/billing'
    });
  }
}

/**
 * Atomically consumes `n` AI generations for the workspace.
 * Resets the counter when the month changed, throws 402 PLAN_LIMIT when the
 * quota would be exceeded and tells owners (once per month) when it runs out.
 * @returns {Promise<{ used: number, max: number|null }>}
 */
async function consumeAi(orgId, n = 1) {
  const period = currentPeriod();
  // Roll the period over (no-op when already current).
  await Organization.updateOne(
    { _id: orgId, 'usage.period': { $ne: period } },
    { $set: { 'usage.period': period, 'usage.aiGenerations': 0 } }
  );
  const org = await Organization.findById(orgId).select('plan').lean();
  if (!org) throw notFound('Workspace not found');
  const max = getLimits(org.plan).aiGenerations;

  const filter = { _id: orgId, 'usage.period': period };
  if (max != null) filter['usage.aiGenerations'] = { $lte: max - n };
  const updated = await Organization.findOneAndUpdate(filter, { $inc: { 'usage.aiGenerations': n } }, { new: true })
    .select('usage')
    .lean();

  if (!updated) {
    await notifyAiLimitOnce(orgId, period);
    const current = await Organization.findById(orgId).select('usage').lean();
    throw planLimit({ limit: 'aiGenerations', used: current.usage.aiGenerations, max, plan: org.plan });
  }
  const used = updated.usage.aiGenerations;
  if (max != null && used >= max) await notifyAiLimitOnce(orgId, period);
  return { used, max };
}

/** Gives back `n` AI generations (e.g. when the AI provider call failed). Never goes below 0. */
async function releaseAi(orgId, n = 1) {
  await Organization.updateOne(
    { _id: orgId, 'usage.period': currentPeriod(), 'usage.aiGenerations': { $gte: n } },
    { $inc: { 'usage.aiGenerations': -n } }
  );
}

/** Express middleware: meters one AI generation for req.user's workspace before the handler runs. */
const meterAi = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.organization) throw unauthenticated();
  req.aiUsage = await consumeAi(req.user.organization);
  next();
});

module.exports = { getLimits, currentPeriod, getUsage, assertSeatAvailable, consumeAi, releaseAi, meterAi, STAFF };
