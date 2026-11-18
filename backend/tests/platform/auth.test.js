const { loadApp, connectFresh, disconnect, uniqueEmail, createWorkspace, request } = require('./helpers');

const { app, connectDB } = loadApp();
const User = require('../../models/User');
const Organization = require('../../models/Organization');

beforeAll(() => connectFresh(connectDB));
afterAll(disconnect);

describe('register (create-workspace)', () => {
  test('creates a workspace with the caller as owner', async () => {
    const body = await createWorkspace(app, { workspaceName: 'Northwind Institute' });
    expect(body.token).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user).toMatchObject({ role: 'owner', name: 'Owner One' });
    expect(body.user.password).toBeUndefined();
    expect(body.workspace).toMatchObject({
      name: 'Northwind Institute',
      slug: 'northwind-institute',
      plan: 'free',
      limits: { staffSeats: 2, students: 50, aiGenerations: 25 },
      usage: { staffSeats: 1, students: 0, aiGenerations: 0 }
    });
    expect(body.user.organization).toBe(body.workspace.id);
  });

  test('a second workspace with the same name gets a unique slug', async () => {
    const body = await createWorkspace(app, { workspaceName: 'Northwind Institute' });
    expect(body.workspace.slug).toMatch(/^northwind-institute-[a-z0-9]{5}$/);
  });

  test('rejects weak passwords, bad emails and missing workspace names', async () => {
    const base = { name: 'X', email: uniqueEmail(), mode: 'create-workspace', workspaceName: 'W' };
    const weak = await request(app).post('/api/auth/register').send({ ...base, password: 'password' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    const badEmail = await request(app).post('/api/auth/register').send({ ...base, email: 'nope', password: 'Passw0rd!' });
    expect(badEmail.status).toBe(400);
    const noWs = await request(app).post('/api/auth/register').send({ ...base, workspaceName: '', password: 'Passw0rd!' });
    expect(noWs.status).toBe(400);
  });

  test('duplicate email → 409 CONFLICT', async () => {
    const { email } = await createWorkspace(app);
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Dup', email: email.toUpperCase(), password: 'Passw0rd!', mode: 'create-workspace', workspaceName: 'Dup' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('unknown join code → 404', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'J', email: uniqueEmail(), password: 'Passw0rd!', mode: 'join', code: 'doesnotexist' });
    expect(res.status).toBe(404);
  });
});

describe('login, lockout, refresh, logout', () => {
  let account;
  beforeAll(async () => { account = await createWorkspace(app); });

  test('logs in with valid credentials and returns the workspace', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: account.email, password: account.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(account.email);
    expect(res.body.workspace.id).toBe(account.workspace.id);
  });

  test('wrong password → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: account.email, password: 'Wrong1234' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('5 failures lock the account for 15 minutes, even for the right password', async () => {
    const { email, password } = await createWorkspace(app);
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' });
    }
    const locked = await request(app).post('/api/auth/login').send({ email, password });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
    expect(locked.body.error.details.retryAfterSeconds).toBeGreaterThan(800);

    // Lock expired → can sign in again
    await User.updateOne({ email }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    const ok = await request(app).post('/api/auth/login').send({ email, password });
    expect(ok.status).toBe(200);
  });

  test('refresh token issues a working access token; logout revokes it', async () => {
    const refreshed = await request(app).post('/api/auth/refresh-token').send({ refreshToken: account.refreshToken });
    expect(refreshed.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refreshed.body.token}`);
    expect(me.status).toBe(200);

    await request(app).post('/api/auth/logout').send({ refreshToken: account.refreshToken }).expect(200);
    const again = await request(app).post('/api/auth/refresh-token').send({ refreshToken: account.refreshToken });
    expect(again.status).toBe(401);
  });

  test('access token cannot be used as a refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh-token').send({ refreshToken: account.token });
    expect(res.status).toBe(401);
  });
});

describe('/me', () => {
  test('GET and PATCH the profile', async () => {
    const { token } = await createWorkspace(app);
    const me = await request(app).get('/api/auth/me').set('x-auth-token', token);
    expect(me.status).toBe(200);
    expect(me.body.user.preferences.theme).toBe('system');
    expect(me.body.workspace.limits).toBeDefined();

    const patched = await request(app).patch('/api/auth/me').set('x-auth-token', token)
      .send({ name: 'Renamed', preferences: { theme: 'dark' }, role: 'owner' });
    expect(patched.status).toBe(200);
    expect(patched.body.user).toMatchObject({ name: 'Renamed', preferences: { theme: 'dark' } });

    const bad = await request(app).patch('/api/auth/me').set('x-auth-token', token).send({ preferences: { theme: 'neon' } });
    expect(bad.status).toBe(400);
  });

  test('no / invalid token → 401 UNAUTHENTICATED', async () => {
    const none = await request(app).get('/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    const bad = await request(app).get('/api/auth/me').set('x-auth-token', 'garbage');
    expect(bad.status).toBe(401);
  });
});

describe('passwords', () => {
  test('change-password: requires the current password, invalidates old sessions, returns new tokens', async () => {
    const acct = await createWorkspace(app);
    const wrong = await request(app).post('/api/auth/change-password').set('x-auth-token', acct.token)
      .send({ currentPassword: 'Nope12345', newPassword: 'NewPassw0rd' });
    expect(wrong.status).toBe(400);

    // Ensure the original token's iat is strictly older than the change.
    await new Promise((r) => setTimeout(r, 1100));
    const res = await request(app).post('/api/auth/change-password').set('x-auth-token', acct.token)
      .send({ currentPassword: acct.password, newPassword: 'NewPassw0rd' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    expect((await request(app).get('/api/auth/me').set('x-auth-token', res.body.token)).status).toBe(200);
    // The old refresh token is no longer accepted
    expect((await request(app).post('/api/auth/refresh-token').send({ refreshToken: acct.refreshToken })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: acct.email, password: acct.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: acct.email, password: 'NewPassw0rd' })).status).toBe(200);
  });

  test('forgot/reset: dev reset URL, single-use token, no enumeration', async () => {
    const acct = await createWorkspace(app);
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.devResetUrl).toBeUndefined();

    const res = await request(app).post('/api/auth/forgot-password').send({ email: acct.email });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(unknown.body.message);
    expect(res.body.devResetUrl).toMatch(/\/reset-password\/[a-f0-9]{64}$/);
    const token = res.body.devResetUrl.split('/').pop();

    const stored = await User.findOne({ email: acct.email }).lean();
    expect(stored.passwordResetTokenHash).not.toBe(token); // only the hash is stored

    const weak = await request(app).post('/api/auth/reset-password').send({ token, password: 'short' });
    expect(weak.status).toBe(400);
    const ok = await request(app).post('/api/auth/reset-password').send({ token, password: 'Reset1234' });
    expect(ok.status).toBe(200);
    const reused = await request(app).post('/api/auth/reset-password').send({ token, password: 'Reset5678' });
    expect(reused.status).toBe(400);

    expect((await request(app).post('/api/auth/login').send({ email: acct.email, password: 'Reset1234' })).status).toBe(200);
  });

  test('expired reset token is rejected', async () => {
    const acct = await createWorkspace(app);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: acct.email });
    const token = res.body.devResetUrl.split('/').pop();
    await User.updateOne({ email: acct.email }, { $set: { passwordResetExpires: new Date(Date.now() - 1000) } });
    const expired = await request(app).post('/api/auth/reset-password').send({ token, password: 'Reset1234' });
    expect(expired.status).toBe(400);
  });
});

describe('invite preview', () => {
  test('GET /invite/:code previews the workspace and role', async () => {
    const owner = await createWorkspace(app, { workspaceName: 'Preview U' });
    const inv = await request(app).post('/api/workspace/invites').set('x-auth-token', owner.token).send({ role: 'instructor' });
    const res = await request(app).get(`/api/auth/invite/${inv.body.invite.code}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ workspace: { name: 'Preview U' }, role: 'instructor', kind: 'invite' });
    expect((await request(app).get('/api/auth/invite/nope')).status).toBe(404);
  });
});

describe('legacy account migration', () => {
  test('accounts without a workspace join the Default Workspace; first staff becomes owner', async () => {
    // Insert raw legacy users (bypassing the model defaults/hooks except hashing).
    const make = (role) => User.create({ name: `Legacy ${role}`, email: uniqueEmail(`legacy-${role}`), password: 'oldpass', role });
    const instructor = await make('instructor');
    const admin = await make('admin');
    const student = await make('student');
    await User.updateMany({ _id: { $in: [instructor._id, admin._id, student._id] } }, { $unset: { organization: 1 } });

    // Legacy 6-char passwords still work for existing accounts.
    const first = await request(app).post('/api/auth/login').send({ email: instructor.email, password: 'oldpass' });
    expect(first.status).toBe(200);
    expect(first.body.user.role).toBe('owner');
    expect(first.body.workspace.name).toBe('Default Workspace');

    const second = await request(app).post('/api/auth/login').send({ email: admin.email, password: 'oldpass' });
    expect(second.body.user.role).toBe('admin');
    expect(second.body.workspace.id).toBe(first.body.workspace.id);

    const stu = await request(app).post('/api/auth/login').send({ email: student.email, password: 'oldpass' });
    expect(stu.body.user.role).toBe('student');
    expect(await Organization.countDocuments({ slug: 'default-workspace' })).toBe(1);
  });
});
