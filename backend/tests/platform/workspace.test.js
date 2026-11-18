const { loadApp, connectFresh, disconnect, createWorkspace, joinViaInvite, request } = require('./helpers');

const { app, connectDB } = loadApp();
const Invite = require('../../models/Invite');

beforeAll(() => connectFresh(connectDB));
afterAll(disconnect);

const auth = (token) => ({ 'x-auth-token': token });

describe('invites & joining', () => {
  let owner;
  beforeAll(async () => { owner = await createWorkspace(app, { workspaceName: 'Invite Co' }); });

  test('joining via an invite assigns the invite role and notifies admins', async () => {
    const { res, invite } = await joinViaInvite(app, owner.token, 'student');
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
    expect(res.body.workspace.id).toBe(owner.workspace.id);
    expect(invite.url).toBe(`http://localhost:3000/join/${invite.code}`);
    expect(invite.code).toMatch(/^[A-Za-z0-9]{12}$/);

    const stored = await Invite.findOne({ code: invite.code }).lean();
    expect(stored.uses).toBe(1);

    const notes = await request(app).get('/api/notifications').set(auth(owner.token));
    expect(notes.body.items.some((n) => n.type === 'member.joined')).toBe(true);
  });

  test('invite list, revoke, and revoked invites cannot be used', async () => {
    const created = await request(app).post('/api/workspace/invites').set(auth(owner.token))
      .send({ role: 'student', expiresInDays: 3, maxUses: 5 });
    expect(created.status).toBe(201);
    expect(created.body.invite).toMatchObject({ role: 'student', maxUses: 5, uses: 0, status: 'active' });
    expect(created.body.code).toBe(created.body.invite.code);
    expect(created.body.url).toBe(`http://localhost:3000/join/${created.body.code}`);

    const list = await request(app).get('/api/workspace/invites').set(auth(owner.token));
    expect(list.body.items.find((i) => i.id === created.body.invite.id)).toBeTruthy();

    const revoked = await request(app).delete(`/api/workspace/invites/${created.body.invite.id}`).set(auth(owner.token));
    expect(revoked.status).toBe(200);
    expect(revoked.body.invite.status).toBe('revoked');

    const join = await request(app).post('/api/auth/register')
      .send({ name: 'Late', email: 'late@example.com', password: 'Passw0rd!', mode: 'join', code: created.body.invite.code });
    expect(join.status).toBe(400);
  });

  test('a single-use invite cannot be used twice', async () => {
    const created = await request(app).post('/api/workspace/invites').set(auth(owner.token)).send({ role: 'student', maxUses: 1 });
    const { code } = created.body.invite;
    const a = await request(app).post('/api/auth/register').send({ name: 'A', email: 'single-a@example.com', password: 'Passw0rd!', mode: 'join', code });
    const b = await request(app).post('/api/auth/register').send({ name: 'B', email: 'single-b@example.com', password: 'Passw0rd!', mode: 'join', code });
    expect(a.status).toBe(201);
    expect(b.status).toBe(400);
  });

  test('staff seat limit on the free plan (2) → 402 PLAN_LIMIT', async () => {
    const ws = await createWorkspace(app, { workspaceName: 'Seat Co' });
    const first = await joinViaInvite(app, ws.token, 'instructor');
    expect(first.res.status).toBe(201);
    const second = await joinViaInvite(app, ws.token, 'instructor');
    expect(second.res.status).toBe(402);
    expect(second.res.body.error).toMatchObject({
      code: 'PLAN_LIMIT',
      details: { limit: 'staffSeats', used: 2, max: 2, plan: 'free' }
    });
    // The failed join did not consume the invite.
    expect((await Invite.findOne({ code: second.invite.code }).lean()).uses).toBe(0);
  });

  test('students and instructors cannot manage invites', async () => {
    const { res } = await joinViaInvite(app, owner.token, 'student');
    const forbidden = await request(app).post('/api/workspace/invites').set(auth(res.body.token)).send({ role: 'admin' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });
});

describe('members', () => {
  let owner;
  let admin;
  let student;
  beforeAll(async () => {
    owner = await createWorkspace(app, { workspaceName: 'Members Co' });
    await request(app).post('/api/workspace/plan').set(auth(owner.token)).send({ plan: 'pro' });
    admin = (await joinViaInvite(app, owner.token, 'admin')).res.body;
    student = (await joinViaInvite(app, owner.token, 'student')).res.body;
  });

  test('lists members (filterable by role); students are forbidden', async () => {
    const all = await request(app).get('/api/workspace/members').set(auth(owner.token));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String), email: expect.any(String), role: 'owner', deactivated: false }));
    const students = await request(app).get('/api/workspace/members?role=student').set(auth(owner.token));
    expect(students.body.items.map((m) => m.role)).toEqual(['student']);
    expect((await request(app).get('/api/workspace/members').set(auth(student.token))).status).toBe(403);
  });

  test('role change takes effect immediately and notifies the member', async () => {
    const res = await request(app).patch(`/api/workspace/members/${student.user.id}`).set(auth(owner.token)).send({ role: 'instructor' });
    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('instructor');
    const me = await request(app).get('/api/auth/me').set(auth(student.token));
    expect(me.body.user.role).toBe('instructor');
    const notes = await request(app).get('/api/notifications').set(auth(student.token));
    expect(notes.body.items[0].type).toBe('member.role_changed');

    const log = await request(app).get('/api/workspace/audit-log?action=member.role_change').set(auth(owner.token));
    expect(log.body.items[0].meta).toEqual({ name: student.user.name, email: student.user.email, role: 'instructor', from: 'student', to: 'instructor' });
  });

  test('last-owner protection and admins cannot modify owners', async () => {
    const demoteSelf = await request(app).patch(`/api/workspace/members/${owner.user.id}`).set(auth(owner.token)).send({ role: 'admin' });
    expect(demoteSelf.status).toBe(409);
    const adminEditsOwner = await request(app).patch(`/api/workspace/members/${owner.user.id}`).set(auth(admin.token)).send({ deactivated: true });
    expect(adminEditsOwner.status).toBe(403);
    const adminPromotes = await request(app).patch(`/api/workspace/members/${student.user.id}`).set(auth(admin.token)).send({ role: 'owner' });
    expect(adminPromotes.status).toBe(403);

    // With a second owner, the first may step down.
    await request(app).patch(`/api/workspace/members/${admin.user.id}`).set(auth(owner.token)).send({ role: 'owner' }).expect(200);
    const stepDown = await request(app).patch(`/api/workspace/members/${owner.user.id}`).set(auth(owner.token)).send({ role: 'admin' });
    expect(stepDown.status).toBe(200);
    // Restore
    await request(app).patch(`/api/workspace/members/${owner.user.id}`).set(auth(admin.token)).send({ role: 'owner' }).expect(200);
  });

  test('removing a member deactivates them and blocks their token', async () => {
    const victim = (await joinViaInvite(app, owner.token, 'student')).res.body;
    const removed = await request(app).delete(`/api/workspace/members/${victim.user.id}`).set(auth(owner.token));
    expect(removed.status).toBe(200);
    expect(removed.body.member.deactivated).toBe(true);
    const me = await request(app).get('/api/auth/me').set(auth(victim.token));
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    const refresh = await request(app).post('/api/auth/refresh-token').send({ refreshToken: victim.refreshToken });
    expect(refresh.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    const login = await request(app).post('/api/auth/login').send({ email: victim.user.email, password: 'Passw0rd!' });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('ACCOUNT_DEACTIVATED');

    const log = await request(app).get('/api/workspace/audit-log?action=member.remove').set(auth(owner.token));
    expect(log.body.items[0]).toMatchObject({ targetType: 'User', targetId: victim.user.id, meta: { name: victim.user.name, email: victim.user.email, role: 'student' } });
  });
});

describe('tenant isolation', () => {
  test("workspace A gets 404 for workspace B's member and invite ids", async () => {
    const a = await createWorkspace(app, { workspaceName: 'Tenant A' });
    const b = await createWorkspace(app, { workspaceName: 'Tenant B' });
    const bInvite = await request(app).post('/api/workspace/invites').set(auth(b.token)).send({ role: 'student' });

    expect((await request(app).patch(`/api/workspace/members/${b.user.id}`).set(auth(a.token)).send({ role: 'student' })).status).toBe(404);
    expect((await request(app).delete(`/api/workspace/members/${b.user.id}`).set(auth(a.token))).status).toBe(404);
    expect((await request(app).delete(`/api/workspace/invites/${bInvite.body.invite.id}`).set(auth(a.token))).status).toBe(404);
    expect((await request(app).delete('/api/workspace/invites/not-an-id').set(auth(a.token))).status).toBe(404);

    const members = await request(app).get('/api/workspace/members').set(auth(a.token));
    expect(members.body.items.map((m) => m.id)).toEqual([a.user.id]);
    const invites = await request(app).get('/api/workspace/invites').set(auth(a.token));
    expect(invites.body.items).toHaveLength(0);
    const log = await request(app).get('/api/workspace/audit-log').set(auth(a.token));
    expect(log.body.items.every((e) => e.actor && e.actor.id === a.user.id)).toBe(true);
  });
});

describe('workspace settings, plans, usage, audit log', () => {
  let owner;
  beforeAll(async () => { owner = await createWorkspace(app, { workspaceName: 'Plan Co' }); });

  test('PATCH workspace validates branding', async () => {
    const ok = await request(app).patch('/api/workspace').set(auth(owner.token))
      .send({ name: 'Plan Company', branding: { primaryColor: '#112233' }, settings: { allowStudentSelfSignup: false } });
    expect(ok.status).toBe(200);
    expect(ok.body.workspace).toMatchObject({ name: 'Plan Company', branding: { primaryColor: '#112233' }, settings: { allowStudentSelfSignup: false } });
    const bad = await request(app).patch('/api/workspace').set(auth(owner.token)).send({ branding: { primaryColor: 'red' } });
    expect(bad.status).toBe(400);
  });

  test('plan catalog and usage', async () => {
    const plans = await request(app).get('/api/workspace/plans').set(auth(owner.token));
    expect(plans.body.plans.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise']);
    expect(plans.body.billingMode).toBe('demo');
    const usage = await request(app).get('/api/workspace/usage').set(auth(owner.token));
    expect(usage.body).toEqual({ plan: 'free', limits: { staffSeats: 2, students: 50, aiGenerations: 25 }, usage: { staffSeats: 1, students: 0, aiGenerations: 0 } });
  });

  test('plan change in demo mode is immediate; only owners may change it', async () => {
    const admin = (await joinViaInvite(app, owner.token, 'admin')).res.body;
    expect((await request(app).post('/api/workspace/plan').set(auth(admin.token)).send({ plan: 'pro' })).status).toBe(403);
    expect((await request(app).post('/api/workspace/plan').set(auth(owner.token)).send({ plan: 'gold' })).status).toBe(400);

    const res = await request(app).post('/api/workspace/plan').set(auth(owner.token)).send({ plan: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body.workspace).toMatchObject({ plan: 'pro', limits: { staffSeats: 25 } });
  });

  test('audit log is paginated and includes actor names', async () => {
    const res = await request(app).get('/api/workspace/audit-log?pageSize=2').set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(4);
    expect(res.body.items[0]).toMatchObject({ action: 'plan.change', actor: { name: 'Owner One' }, meta: { from: 'free', to: 'pro' } });
    const actions = (await request(app).get('/api/workspace/audit-log?pageSize=100').set(auth(owner.token))).body.items.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['workspace.create', 'workspace.update', 'invite.create', 'member.join']));
  });
});

describe('plan change outside demo mode', () => {
  test('records the request and returns 402 CONTACT_SALES', async () => {
    const owner = await createWorkspace(app, { workspaceName: 'Sales Co' });
    process.env.BILLING_MODE = 'contact-sales';
    try {
      const res = await request(app).post('/api/workspace/plan').set(auth(owner.token)).send({ plan: 'enterprise' });
      expect(res.status).toBe(402);
      expect(res.body.error.code).toBe('CONTACT_SALES');
    } finally {
      delete process.env.BILLING_MODE;
    }
    const ws = await request(app).get('/api/workspace').set(auth(owner.token));
    expect(ws.body.workspace.plan).toBe('free');
    const log = await request(app).get('/api/workspace/audit-log').set(auth(owner.token));
    expect(log.body.items[0].action).toBe('plan.upgrade_request');
    const notes = await request(app).get('/api/notifications').set(auth(owner.token));
    expect(notes.body.items[0].type).toBe('plan.upgrade_requested');
  });
});
