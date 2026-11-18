const express = require('express');
const { loadApp, connectFresh, disconnect, createWorkspace, joinViaInvite, request } = require('./helpers');

const { app, connectDB } = loadApp();
const Organization = require('../../models/Organization');
const Notification = require('../../models/Notification');
const plans = require('../../services/plans');
const { notify } = require('../../services/notify');
const { requireAuth } = require('../../middlewares/auth');
const { errorHandler } = require('../../middlewares/errorHandler');

beforeAll(() => connectFresh(connectDB));
afterAll(disconnect);

const auth = (token) => ({ 'x-auth-token': token });

describe('AI quota (consumeAi / meterAi)', () => {
  test('free plan allows 25 generations a month, then 402; owners are notified once', async () => {
    const owner = await createWorkspace(app, { workspaceName: 'Quota Co' });
    const orgId = owner.workspace.id;

    const first = await plans.consumeAi(orgId, 20);
    expect(first).toEqual({ used: 20, max: 25 });
    await expect(plans.consumeAi(orgId, 6)).rejects.toMatchObject({ status: 402, code: 'PLAN_LIMIT' });
    for (let i = 0; i < 5; i += 1) await plans.consumeAi(orgId); // eslint-disable-line no-await-in-loop
    await expect(plans.consumeAi(orgId)).rejects.toMatchObject({
      status: 402,
      code: 'PLAN_LIMIT',
      details: { limit: 'aiGenerations', used: 25, max: 25, plan: 'free' }
    });
    await expect(plans.consumeAi(orgId)).rejects.toMatchObject({ status: 402 });

    const limitNotes = await Notification.countDocuments({ organization: orgId, type: 'plan.limit_reached' });
    expect(limitNotes).toBe(1);
    expect((await plans.getUsage(orgId)).aiGenerations).toBe(25);

    // releaseAi gives one back
    await plans.releaseAi(orgId);
    expect((await plans.getUsage(orgId)).aiGenerations).toBe(24);
  });

  test('the counter resets in a new month', async () => {
    const owner = await createWorkspace(app, { workspaceName: 'Rollover Co' });
    const orgId = owner.workspace.id;
    await Organization.updateOne({ _id: orgId }, { $set: { 'usage.period': '2000-01', 'usage.aiGenerations': 25 } });
    expect((await plans.getUsage(orgId)).aiGenerations).toBe(0);
    expect(await plans.consumeAi(orgId)).toEqual({ used: 1, max: 25 });
  });

  test('enterprise is unlimited', async () => {
    const owner = await createWorkspace(app, { workspaceName: 'Big Co' });
    await request(app).post('/api/workspace/plan').set(auth(owner.token)).send({ plan: 'enterprise' }).expect(200);
    expect(await plans.consumeAi(owner.workspace.id, 5000)).toEqual({ used: 5000, max: null });
  });

  test('meterAi middleware returns 402 PLAN_LIMIT JSON once the quota is used', async () => {
    const owner = await createWorkspace(app, { workspaceName: 'Meter Co' });
    await Organization.updateOne({ _id: owner.workspace.id }, { $set: { 'usage.period': plans.currentPeriod(), 'usage.aiGenerations': 24 } });
    const mini = express();
    mini.post('/ai', requireAuth, plans.meterAi, (req, res) => res.json({ ok: true, usage: req.aiUsage }));
    mini.use(errorHandler);

    const ok = await request(mini).post('/ai').set(auth(owner.token));
    expect(ok.status).toBe(200);
    expect(ok.body.usage).toEqual({ used: 25, max: 25 });
    const blocked = await request(mini).post('/ai').set(auth(owner.token));
    expect(blocked.status).toBe(402);
    expect(blocked.body.error.code).toBe('PLAN_LIMIT');
  });

  test('assertSeatAvailable throws PLAN_LIMIT for students past the limit', async () => {
    const owner = await createWorkspace(app, { workspaceName: 'Students Co' });
    await expect(plans.assertSeatAvailable(owner.workspace.id, 'student')).resolves.toBeUndefined();
    await expect(plans.assertSeatAvailable(owner.workspace.id, 'admin')).resolves.toBeUndefined();
    await joinViaInvite(app, owner.token, 'admin');
    await expect(plans.assertSeatAvailable(owner.workspace.id, 'instructor')).rejects.toMatchObject({ status: 402 });
  });
});

describe('notifications', () => {
  let owner;
  let student;
  beforeAll(async () => {
    owner = await createWorkspace(app, { workspaceName: 'Notify Co' });
    student = (await joinViaInvite(app, owner.token, 'student')).res.body;
    const orgId = owner.workspace.id;
    await notify([student.user.id], { type: 'assessment.published', title: 'Quiz 1 is open', link: '/app/take/1' }, orgId);
    await notify(student.user.id, { type: 'results.released', title: 'Results for Quiz 0' }, orgId);
  });

  test('lists newest first with unreadCount; ?unread=true filters', async () => {
    const res = await request(app).get('/api/notifications').set(auth(student.token));
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items.map((n) => n.title)).toEqual(['Results for Quiz 0', 'Quiz 1 is open']);
    expect(res.body.items[0]).toEqual(expect.objectContaining({ id: expect.any(String), readAt: null, type: 'results.released' }));
  });

  test("mark one as read; other users' notifications are 404", async () => {
    const list = await request(app).get('/api/notifications').set(auth(student.token));
    const target = list.body.items[0];
    expect((await request(app).post(`/api/notifications/${target.id}/read`).set(auth(owner.token))).status).toBe(404);

    const res = await request(app).post(`/api/notifications/${target.id}/read`).set(auth(student.token));
    expect(res.status).toBe(200);
    expect(res.body.notification.readAt).toBeTruthy();
    expect(res.body.unreadCount).toBe(1);
    const unread = await request(app).get('/api/notifications?unread=true').set(auth(student.token));
    expect(unread.body.items).toHaveLength(1);
  });

  test('read-all', async () => {
    const res = await request(app).post('/api/notifications/read-all').set(auth(student.token));
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    const after = await request(app).get('/api/notifications').set(auth(student.token));
    expect(after.body.unreadCount).toBe(0);
  });

  test('notify never throws on bad input', async () => {
    await expect(notify(['not-an-id'], { type: 'x', title: 'y' }, owner.workspace.id)).resolves.toBe(0);
    await expect(notify([], { type: 'x', title: 'y' }, owner.workspace.id)).resolves.toBe(0);
  });
});
