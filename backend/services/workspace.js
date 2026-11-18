/**
 * Workspace (Organization) helpers shared by auth and workspace routes.
 */
const Organization = require('../models/Organization');
const User = require('../models/User');
const { getLimits, getUsage } = require('./plans');
const { randomCode } = require('./tokens');
const { serialize } = require('../utils/serialize');

const DEFAULT_WORKSPACE_SLUG = 'default-workspace';
const ROLES_KNOWN = ['owner', 'admin', 'instructor', 'student'];

/** API shape: { id, name, slug, plan, branding, settings, usage, limits }. */
async function toWorkspaceDTO(org) {
  if (!org) return null;
  const plain = serialize(org);
  return {
    id: plain.id,
    name: plain.name,
    slug: plain.slug,
    plan: plain.plan,
    branding: plain.branding || {},
    settings: plain.settings || {},
    usage: await getUsage(plain.id),
    limits: getLimits(plain.plan),
    createdAt: plain.createdAt
  };
}

/** URL slug derived from `name`, made unique with a random suffix when taken. */
async function uniqueSlug(name) {
  const base = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40) || 'workspace';
  let slug = base;
  // eslint-disable-next-line no-await-in-loop
  while (await Organization.exists({ slug })) slug = `${base}-${randomCode(5, 'abcdefghjkmnpqrstuvwxyz23456789')}`;
  return slug;
}

/**
 * Migration for accounts created before workspaces existed: attaches `user`
 * (a Mongoose document without `organization`) to the shared "Default
 * Workspace". The first legacy instructor/admin attached becomes its owner.
 * Seat limits are intentionally not enforced here (existing data).
 * @returns {Promise<import('mongoose').Document>} the updated user
 */
async function attachLegacyUser(user) {
  if (user.organization) return user;
  let org;
  try {
    org = await Organization.findOneAndUpdate(
      { slug: DEFAULT_WORKSPACE_SLUG },
      { $setOnInsert: { name: 'Default Workspace', slug: DEFAULT_WORKSPACE_SLUG, plan: 'free' } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err; // concurrent upsert: the other one won
    org = await Organization.findOne({ slug: DEFAULT_WORKSPACE_SLUG });
  }

  let role = ROLES_KNOWN.includes(user.role) ? user.role : 'student';
  if (role === 'instructor' || role === 'admin') {
    // Atomically claim ownership: only the first staff member gets it.
    const claimed = await Organization.findOneAndUpdate(
      { _id: org._id, createdBy: { $exists: false } },
      { $set: { createdBy: user._id } }
    );
    if (claimed) role = 'owner';
  }
  await User.updateOne({ _id: user._id, organization: null }, { $set: { organization: org._id, role } });
  user.organization = org._id;
  user.role = role;
  return user;
}

module.exports = { toWorkspaceDTO, uniqueSlug, attachLegacyUser, DEFAULT_WORKSPACE_SLUG };
