const express = require('express');
const mongoose = require('mongoose');
const { loadApp, connectFresh, disconnect, createWorkspace, joinViaInvite, uniqueEmail, request } = require('./helpers');

const { app, connectDB } = loadApp();
const auth = require('../../middlewares/auth');
const { errorHandler } = require('../../middlewares/errorHandler');

beforeAll(() => connectFresh(connectDB));
afterAll(disconnect);

describe('legacy middleware compatibility', () => {
  test('the module is a callable middleware with requireRole/optionalAuth attached', () => {
    expect(typeof auth).toBe('function');
    expect(typeof auth.requireRole).toBe('function');
    expect(typeof auth.optionalAuth).toBe('function');
    expect(auth.requireAuth).toBeDefined();
    expect(auth.STAFF_ROLES).toEqual(['owner', 'admin', 'instructor']);
    expect(auth.ADMIN_ROLES).toEqual(['owner', 'admin']);
  });

  test('AI tool routes authenticate with the new tokens and reject anonymous / x-test-mode callers', async () => {
    const owner = await createWorkspace(app);
    const anon = await request(app).get('/api/assessment/templates/default');
    expect(anon.status).toBe(401);
    const bypass = await request(app).get('/api/assessment/templates/default').set('x-test-mode', 'true');
    expect(bypass.status).toBe(401);
    const authed = await request(app).get('/api/assessment/templates/default').set('x-auth-token', owner.token);
    expect(authed.status).toBe(200);
  });

  test('removed legacy endpoints answer 404', async () => {
    const owner = await createWorkspace(app);
    for (const path of ['/api/adaptive-learning/course-1', '/api/curriculum/courses/enrolled', '/api/student/assessment/upcoming', '/api/assessment/student/upcoming']) {
      // eslint-disable-next-line no-await-in-loop
      expect((await request(app).get(path).set('x-auth-token', owner.token)).status).toBe(404);
    }
    expect((await request(app).post('/api/assessment/iterate-quiz').set('x-auth-token', owner.token).send({})).status).toBe(404);
  });

  test("legacy requireRole('instructor') admits owner/admin/instructor, not students", async () => {
    const mini = express();
    mini.get('/staff', auth, auth.requireRole('instructor'), (req, res) => res.json(req.user));
    mini.get('/maybe', auth.optionalAuth, (req, res) => res.json({ user: req.user || null }));
    mini.use(errorHandler);

    const owner = await createWorkspace(app);
    const student = (await joinViaInvite(app, owner.token, 'student')).res.body;

    const ok = await request(mini).get('/staff').set('Authorization', `Bearer ${owner.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ id: owner.user.id, role: 'owner', organization: owner.workspace.id, name: 'Owner One', email: owner.email });
    expect((await request(mini).get('/staff').set('x-auth-token', student.token)).status).toBe(403);

    expect((await request(mini).get('/maybe')).body).toEqual({ user: null });
    expect((await request(mini).get('/maybe').set('x-auth-token', student.token)).body.user.role).toBe('student');
  });
});

describe('joining with a course join code', () => {
  test('creates a student in the course workspace and enrolls them', async () => {
    const { Course, Enrollment } = mongoose.models;
    expect(Course).toBeDefined();
    const owner = await createWorkspace(app, { workspaceName: 'Course Co' });
    const course = await Course.create({ organization: owner.workspace.id, title: 'Data Structures', code: 'CS201', createdBy: owner.user.id, instructors: [owner.user.id] });
    expect(course.joinCode).toMatch(/^[A-Z0-9]{6}$/);

    const preview = await request(app).get(`/api/auth/invite/${course.joinCode.toLowerCase()}`);
    expect(preview.body).toEqual({ workspace: { name: 'Course Co' }, role: 'student', kind: 'course', course: { title: 'Data Structures' } });

    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Stu Dent', email: uniqueEmail('stu'), password: 'Passw0rd!', mode: 'join', code: course.joinCode });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
    expect(res.body.workspace.id).toBe(owner.workspace.id);
    if (Enrollment) {
      const enrollment = await Enrollment.findOne({ course: course._id, student: res.body.user.id }).lean();
      expect(enrollment).toMatchObject({ status: 'active' });
    }

    // Disabled join codes are refused.
    await Course.updateOne({ _id: course._id }, { $set: { joinCodeEnabled: false } });
    const refused = await request(app).post('/api/auth/register')
      .send({ name: 'Too Late', email: uniqueEmail('stu'), password: 'Passw0rd!', mode: 'join', code: course.joinCode });
    expect(refused.status).toBe(400);
  });
});
