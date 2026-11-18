/**
 * Shared setup for platform tests. Each test file gets a fresh module registry
 * (and therefore fresh in-memory rate limiters) and a clean database.
 *
 * Uses MONGO_URI_TEST (default mongodb://127.0.0.1:27017/navigate_test_platform).
 * The database name must contain "test" — it is dropped before each file.
 */
const mongoose = require('mongoose');
const request = require('supertest');

const TEST_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/navigate_test_platform';

/** Loads the app with the given env overrides (call before any other require of server modules). */
function loadApp(envOverrides = {}) {
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
  process.env.RATE_LIMIT_AUTH_MAX = '1000';
  process.env.RATE_LIMIT_GENERAL_MAX = '10000';
  delete process.env.BILLING_MODE;
  Object.assign(process.env, envOverrides);
  return require('../../server');
}

async function connectFresh(connectDB) {
  const dbName = new URL(TEST_URI).pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error(`Refusing to drop non-test database "${dbName}"`);
  const ok = await connectDB(TEST_URI);
  if (!ok) throw new Error(`Cannot connect to ${TEST_URI}`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
}

const disconnect = () => mongoose.disconnect();

let counter = 0;
const uniqueEmail = (prefix = 'user') => `${prefix}.${Date.now()}.${(counter += 1)}@example.com`;

/** Registers a new workspace owner; returns the response body plus `email`/`password`. */
async function createWorkspace(app, { name = 'Owner One', workspaceName = 'Acme Academy', email = uniqueEmail('owner'), password = 'Passw0rd!' } = {}) {
  const res = await request(app).post('/api/auth/register')
    .send({ name, email, password, mode: 'create-workspace', workspaceName });
  if (res.status !== 201) throw new Error(`createWorkspace failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, email, password };
}

/** Creates an invite as `token` and registers a member through it. */
async function joinViaInvite(app, ownerToken, role, { name = `New ${role}`, email = uniqueEmail(role), password = 'Passw0rd!' } = {}) {
  const inv = await request(app).post('/api/workspace/invites').set('x-auth-token', ownerToken).send({ role });
  if (inv.status !== 201) throw new Error(`invite failed: ${inv.status} ${JSON.stringify(inv.body)}`);
  const res = await request(app).post('/api/auth/register')
    .send({ name, email, password, mode: 'join', code: inv.body.invite.code });
  return { res, invite: inv.body.invite, email, password };
}

module.exports = { loadApp, connectFresh, disconnect, uniqueEmail, createWorkspace, joinViaInvite, request };
