const {
  loadApp, connectFresh, disconnect, createWorkspace, createCourse, createAssessment, sampleQuestions, auth, request
} = require('./helpers');

jest.mock('../../services/plagiarismService', () => ({
  checkSubmission: jest.fn(async () => ({ isPlagiarismDetected: false, overallSimilarityScore: 0 }))
}));

const { app, connectDB } = loadApp();
const Notification = require('../../models/Notification');

let ws;
let other;
let course;
beforeAll(async () => {
  await connectFresh(connectDB);
  ws = await createWorkspace({ name: 'Assess Co', studentCount: 3 });
  other = await createWorkspace({ name: 'Elsewhere', studentCount: 1 });
  course = await createCourse(app, ws.instructor, ws.students);
});
afterAll(disconnect);

const hour = 60 * 60 * 1000;
const KEY_FIELDS = ['correctAnswer', 'explanation'];

/** Fails if any object nested in `value` carries an answer key or explanation. */
function expectNoKeys(value) {
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      KEY_FIELDS.forEach((k) => expect(v).not.toHaveProperty(k));
      Object.values(v).forEach(walk);
    }
  };
  walk(value);
}

describe('authoring', () => {
  test('create normalises questions and derives totalPoints; publish validates keys and notifies students', async () => {
    const res = await request(app).post('/api/assessments').set(auth(ws.instructor)).send({
      courseId: course.id,
      title: 'Normalise',
      questions: [
        { type: 'Multiple Choice', text: 'Pick B', options: ['a', 'b', 'c'], correctAnswer: 'B', points: 3 },
        { type: 'True/False', text: 'Yes?', correctAnswer: true },
        { type: 'MCQ', text: 'No key', options: ['x', 'y'] }
      ]
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.totalPoints).toBe(5);
    expect(res.body.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
    expect(res.body.questions[0]).toMatchObject({ type: 'multiple-choice', correctAnswer: 'b' });
    expect(res.body.questions[1]).toMatchObject({ type: 'true-false', correctAnswer: 'True', options: ['True', 'False'] });

    const blocked = await request(app).post(`/api/assessments/${res.body.id}/publish`).set(auth(ws.instructor));
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.details.problems).toEqual(['Question 3 needs a correct answer']);

    const empty = await createAssessment(app, ws.instructor, course.id, { questions: [] }, { publish: false });
    expect((await request(app).post(`/api/assessments/${empty.id}/publish`).set(auth(ws.instructor))).status).toBe(400);

    const published = await createAssessment(app, ws.instructor, course.id, { title: 'Announce me' });
    expect(published.status).toBe('published');
    const notes = await Notification.find({ type: 'assessment.published', title: /Announce me/ }).lean();
    expect(notes.map((n) => String(n.user)).sort()).toEqual(ws.students.map((s) => s.id).sort());
  });

  test('questions are locked once students started, except forced wording fixes', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { maxAttempts: 2 });
    await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(ws.students[0]));
    const questions = sampleQuestions();
    questions[0].correctAnswer = 'Rome';
    const locked = await request(app).patch(`/api/assessments/${quiz.id}`).set(auth(ws.instructor)).send({ questions });
    expect(locked.status).toBe(409);

    questions[0].text = 'What is the capital of France?';
    const forced = await request(app).patch(`/api/assessments/${quiz.id}?force=true`).set(auth(ws.instructor)).send({ questions });
    expect(forced.status).toBe(200);
    expect(forced.body.questions[0]).toMatchObject({ text: 'What is the capital of France?', correctAnswer: 'Paris' });
  });

  test('duplicate creates a draft copy; close stops new attempts; delete archives', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Original' });
    const copy = await request(app).post(`/api/assessments/${quiz.id}/duplicate`).set(auth(ws.instructor));
    expect(copy.status).toBe(201);
    expect(copy.body).toMatchObject({ title: 'Copy of Original', status: 'draft', submissionCount: 0 });
    expect(copy.body.questions).toHaveLength(5);

    expect((await request(app).post(`/api/assessments/${quiz.id}/close`).set(auth(ws.instructor))).body.status).toBe('closed');
    const start = await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(ws.students[1]));
    expect(start.status).toBe(409);
    expect(start.body.error.details.reason).toBe('closed');

    expect((await request(app).delete(`/api/assessments/${copy.body.id}`).set(auth(ws.instructor))).status).toBe(200);
    const list = await request(app).get(`/api/assessments?courseId=${course.id}`).set(auth(ws.instructor));
    expect(list.body.items.find((a) => a.id === copy.body.id)).toBeUndefined();
  });
});

describe('archive, restore and unpublish', () => {
  test('archived assessments can be listed and restored; unpublish only before anyone started', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Archive me' });
    await request(app).delete(`/api/assessments/${quiz.id}`).set(auth(ws.instructor));
    const archived = await request(app).get(`/api/assessments?courseId=${course.id}&status=archived`).set(auth(ws.instructor));
    expect(archived.body.items.map((a) => a.id)).toContain(quiz.id);
    expect(archived.body.items.every((a) => a.status === 'archived')).toBe(true);
    const all = await request(app).get(`/api/assessments?courseId=${course.id}&includeArchived=true`).set(auth(ws.instructor));
    expect(all.body.items.some((a) => a.id === quiz.id)).toBe(true);
    expect(all.body.items.some((a) => a.status !== 'archived')).toBe(true);
    expect((await request(app).get('/api/assessments?status=bogus').set(auth(ws.instructor))).status).toBe(400);

    const restored = await request(app).post(`/api/assessments/${quiz.id}/restore`).set(auth(ws.instructor));
    expect(restored.status).toBe(200);
    expect(restored.body.status).toBe('draft');
    expect((await request(app).post(`/api/assessments/${quiz.id}/restore`).set(auth(ws.instructor))).status).toBe(409);

    // Unpublish: allowed while nobody has started, refused afterwards.
    await request(app).post(`/api/assessments/${quiz.id}/publish`).set(auth(ws.instructor));
    const unpublished = await request(app).post(`/api/assessments/${quiz.id}/unpublish`).set(auth(ws.instructor));
    expect(unpublished.body.status).toBe('draft');
    expect((await request(app).get(`/api/assessments/${quiz.id}`).set(auth(ws.students[0]))).status).toBe(404);
    await request(app).post(`/api/assessments/${quiz.id}/publish`).set(auth(ws.instructor));
    await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(ws.students[0]));
    const refused = await request(app).post(`/api/assessments/${quiz.id}/unpublish`).set(auth(ws.instructor));
    expect(refused.status).toBe(409);
    expect(refused.body.error.details.reason).toBe('has-submissions');
    expect(refused.body.message).toMatch(/Close it instead/);
    expect((await request(app).post(`/api/assessments/${quiz.id}/unpublish`).set(auth(ws.students[0]))).status).toBe(403);
  });
});

describe('students never receive answer keys', () => {
  test('list, detail, attempt start and pre-release result are key-free', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, {
      title: 'Secret keys', resultsPolicy: 'manual', showCorrectAnswers: true
    });
    const draft = await createAssessment(app, ws.instructor, course.id, { title: 'Hidden draft' }, { publish: false });
    const student = ws.students[2];

    const list = await request(app).get(`/api/assessments?courseId=${course.id}`).set(auth(student));
    expect(list.status).toBe(200);
    const item = list.body.items.find((a) => a.id === quiz.id);
    expect(item.questions).toBeUndefined();
    expect(item.myStatus).toMatchObject({ attempts: 0, canStart: true, inProgressSubmissionId: null });
    expect(list.body.items.find((a) => a.id === draft.id)).toBeUndefined();
    expectNoKeys(list.body);

    const detail = await request(app).get(`/api/assessments/${quiz.id}`).set(auth(student));
    expect(detail.body.questions).toBeUndefined();
    expectNoKeys(detail.body);
    expect((await request(app).get(`/api/assessments/${draft.id}`).set(auth(student))).status).toBe(404);

    const start = await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(student));
    expect(start.status).toBe(201);
    expect(start.body.assessment.questions).toHaveLength(5);
    expectNoKeys(start.body);

    const submit = await request(app).post(`/api/submissions/${start.body.submission.id}/submit`).set(auth(student))
      .send({ answers: { mc1: 'Paris' } });
    expect(submit.status).toBe(200);
    expect(submit.body.released).toBe(false);
    expect(submit.body.score).toBeUndefined();
    expect(submit.body.questions).toBeUndefined();
    expectNoKeys(submit.body);
  });
});

describe('attempt rules', () => {
  test('availability window and due date are enforced', async () => {
    const future = await createAssessment(app, ws.instructor, course.id, {
      availableFrom: new Date(Date.now() + hour).toISOString(), dueDate: new Date(Date.now() + 2 * hour).toISOString()
    });
    const res = await request(app).post(`/api/assessments/${future.id}/attempts`).set(auth(ws.students[0]));
    expect(res.status).toBe(409);
    expect(res.body.error.details.reason).toBe('not-yet-available');

    const past = await createAssessment(app, ws.instructor, course.id, { dueDate: new Date(Date.now() - hour).toISOString() });
    const late = await request(app).post(`/api/assessments/${past.id}/attempts`).set(auth(ws.students[0]));
    expect(late.status).toBe(409);
    expect(late.body.error.details.reason).toBe('past-due');
  });

  test('maxAttempts is enforced and myStatus reports it', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { maxAttempts: 2 });
    const student = ws.students[0];
    for (let i = 0; i < 2; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const start = await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(student));
      expect(start.status).toBe(201);
      expect(start.body.submission.attempt).toBe(i + 1);
      // eslint-disable-next-line no-await-in-loop
      await request(app).post(`/api/submissions/${start.body.submission.id}/submit`).set(auth(student)).send({ answers: {} });
    }
    const third = await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(student));
    expect(third.status).toBe(409);
    expect(third.body.error.details.reason).toBe('no-attempts-left');
    const detail = await request(app).get(`/api/assessments/${quiz.id}`).set(auth(student));
    expect(detail.body.myStatus).toMatchObject({
      attempts: 2, attemptsRemaining: 0, inProgress: false, canStart: false, reason: 'no-attempts-left', bestPercentage: 0
    });
  });

  test('resuming returns the same submission, order and option shuffle', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `m${i}`, type: 'multiple-choice', text: `Q${i}`, options: ['a', 'b', 'c', 'd', 'e'], correctAnswer: 'a'
    }));
    const quiz = await createAssessment(app, ws.instructor, course.id, {
      questions: many, shuffleQuestions: true, shuffleOptions: true, timeLimit: 30
    });
    const student = ws.students[1];
    const first = await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(student));
    await request(app).patch(`/api/submissions/${first.body.submission.id}/answers`).set(auth(student)).send({ answers: { m3: 'b' } });
    const second = await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(student));
    expect(second.body.submission.id).toBe(first.body.submission.id);
    expect(second.body.submission.answers).toEqual({ m3: 'b' });
    expect(second.body.assessment.questions).toEqual(first.body.assessment.questions);
    expect(new Set(first.body.assessment.questions.map((q) => q.id))).toEqual(new Set(many.map((q) => q.id)));
    const deadline = new Date(first.body.submission.deadlineAt).getTime() - new Date(first.body.submission.startedAt).getTime();
    expect(deadline).toBe(30 * 60 * 1000);

    const detail = await request(app).get(`/api/assessments/${quiz.id}`).set(auth(student));
    // `attempts` counts finished attempts only; the open one is reported via inProgress.
    expect(detail.body.myStatus).toMatchObject({
      attempts: 0, inProgress: true, inProgressSubmissionId: first.body.submission.id, reason: 'in-progress', canStart: true
    });
  });

  test('students outside the course and staff cannot start attempts', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id);
    const outsider = await createWorkspace({ name: 'Assess Co Two', studentCount: 1 });
    expect((await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(outsider.students[0]))).status).toBe(404);
    expect((await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(ws.instructor))).status).toBe(403);
  });
});

describe('tenant isolation', () => {
  test('another workspace gets 404 for assessments and submissions', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id);
    const start = await request(app).post(`/api/assessments/${quiz.id}/attempts`).set(auth(ws.students[2]));
    const submissionId = start.body.submission.id;
    const outsider = other.owner;
    expect((await request(app).get(`/api/assessments/${quiz.id}`).set(auth(outsider))).status).toBe(404);
    expect((await request(app).patch(`/api/assessments/${quiz.id}`).set(auth(outsider)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).get(`/api/assessments/${quiz.id}/submissions`).set(auth(outsider))).status).toBe(404);
    expect((await request(app).get(`/api/submissions/${submissionId}`).set(auth(outsider))).status).toBe(404);
    expect((await request(app).patch(`/api/submissions/${submissionId}/grade`).set(auth(outsider)).send({ overrideScore: 1 })).status).toBe(404);
    expect((await request(app).get(`/api/analytics/assessments/${quiz.id}`).set(auth(outsider))).status).toBe(404);
    // Another student of the same workspace cannot read it either.
    expect((await request(app).get(`/api/submissions/${submissionId}`).set(auth(ws.students[0]))).status).toBe(404);
    const otherList = await request(app).get('/api/assessments').set(auth(other.students[0]));
    expect(otherList.body.items).toEqual([]);
  });
});
