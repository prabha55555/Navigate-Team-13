const {
  loadApp, connectFresh, disconnect, createWorkspace, createCourse, createAssessment, takeAssessment, auth, request
} = require('./helpers');

jest.mock('../../services/plagiarismService', () => ({
  checkSubmission: jest.fn(async () => ({ isPlagiarismDetected: false, overallSimilarityScore: 0 }))
}));

const { app, connectDB } = loadApp();
const { clientIp } = require('../../services/audit');

beforeAll(() => connectFresh(connectDB));
afterAll(disconnect);

describe('audit trail of staff actions', () => {
  test('every learning staff action is logged with a readable name, actor and client IP', async () => {
    const ws = await createWorkspace({ name: 'Audit Co', studentCount: 2 });
    const [s1, s2] = ws.students;
    const course = await createCourse(app, ws.instructor, [s1, s2]);
    const as = (user) => auth(user);

    await request(app).patch(`/api/courses/${course.id}`).set(as(ws.instructor)).send({ term: 'Spring' });
    await request(app).post(`/api/courses/${course.id}/join-code/regenerate`).set(as(ws.instructor));
    await request(app).post(`/api/courses/${course.id}/instructors`).set(as(ws.owner)).send({ userId: ws.instructor2.id });
    await request(app).delete(`/api/courses/${course.id}/instructors/${ws.instructor2.id}`).set(as(ws.owner));
    await request(app).delete(`/api/courses/${course.id}/students/${s2.id}`).set(as(ws.instructor));

    const quiz = await createAssessment(app, ws.instructor, course.id, { resultsPolicy: 'manual' }); // create + publish
    const result = await takeAssessment(app, s1, quiz.id, { mc1: 'Paris' });
    await request(app).patch(`/api/submissions/${result.id}/grade`).set(as(ws.instructor)).send({ overrideScore: 5 });
    await request(app).post(`/api/assessments/${quiz.id}/release-results`).set(as(ws.instructor));
    await request(app).post(`/api/assessments/${quiz.id}/close`).set(as(ws.instructor));
    const copy = await request(app).post(`/api/assessments/${quiz.id}/duplicate`).set(as(ws.instructor));
    await request(app).post(`/api/assessments/${copy.body.id}/publish`).set(as(ws.instructor));
    await request(app).post(`/api/assessments/${copy.body.id}/unpublish`).set(as(ws.instructor));
    await request(app).delete(`/api/assessments/${copy.body.id}`).set(as(ws.instructor));
    await request(app).post(`/api/assessments/${copy.body.id}/restore`).set(as(ws.instructor));
    await request(app).delete(`/api/courses/${course.id}`).set(as(ws.owner));

    const res = await request(app).get('/api/workspace/audit-log?pageSize=100').set(as(ws.owner));
    expect(res.status).toBe(200);
    const actions = res.body.items.map((e) => e.action);
    [
      'course.create', 'course.update', 'course.archive', 'course.join_code_regenerate',
      'course.student_add', 'course.student_remove', 'course.instructor_add', 'course.instructor_remove',
      'assessment.create', 'assessment.publish', 'assessment.close', 'assessment.release_results',
      'assessment.duplicate', 'assessment.unpublish', 'assessment.archive', 'assessment.restore',
      'submission.grade'
    ].forEach((action) => expect(actions).toContain(action));

    res.body.items.forEach((e) => {
      expect(e.ip).toBe('127.0.0.1');
      expect(e.actor).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
    });
    const close = res.body.items.find((e) => e.action === 'assessment.close');
    expect(close).toMatchObject({ targetType: 'Assessment', targetId: quiz.id, actor: { id: ws.instructor.id } });
  });

  test('client IPs are normalised', () => {
    expect(clientIp({ ip: '::ffff:127.0.0.1' })).toBe('127.0.0.1');
    expect(clientIp({ ip: '::FFFF:10.1.2.3' })).toBe('10.1.2.3');
    expect(clientIp({ ip: '::1' })).toBe('127.0.0.1');
    expect(clientIp({ ip: '2001:db8::7' })).toBe('2001:db8::7');
    expect(clientIp({ socket: { remoteAddress: '::ffff:192.168.0.9' } })).toBe('192.168.0.9');
    expect(clientIp({})).toBeUndefined();
  });

  test('TRUST_PROXY makes req.ip the forwarded client address', async () => {
    const express = require('express');
    let ip;
    jest.isolateModules(() => {
      process.env.TRUST_PROXY = '1';
      const isolated = require('../../server').app;
      expect(isolated.get('trust proxy')).toBe(1);
      delete process.env.TRUST_PROXY;
      // Same setting on a tiny app, to read req.ip without touching the database.
      const mini = express();
      mini.set('trust proxy', isolated.get('trust proxy'));
      mini.get('/ip', (req, res) => res.json({ ip: clientIp(req) }));
      ip = request(mini).get('/ip').set('X-Forwarded-For', '203.0.113.7');
    });
    expect((await ip).body.ip).toBe('203.0.113.7');
  });
});
