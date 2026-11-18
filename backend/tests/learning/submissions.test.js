const {
  loadApp, connectFresh, disconnect, createWorkspace, createCourse, createAssessment, takeAssessment, auth, request
} = require('./helpers');

jest.mock('../../services/plagiarismService', () => ({
  checkSubmission: jest.fn(async () => ({
    isPlagiarismDetected: true, overallSimilarityScore: 0.91, detectionMethods: ['mock'], similarityMatches: []
  }))
}));

const { app, connectDB } = loadApp();
const Submission = require('../../models/Submission');
const Notification = require('../../models/Notification');
const AuditLog = require('../../models/AuditLog');
const plagiarismService = require('../../services/plagiarismService');
const { whenIdle } = require('../../services/attemptService');

let ws;
let course;
beforeAll(async () => {
  await connectFresh(connectDB);
  ws = await createWorkspace({ name: 'Submit Co', studentCount: 4 });
  course = await createCourse(app, ws.instructor, ws.students);
});
afterAll(disconnect);

const start = async (student, assessmentId) => {
  const res = await request(app).post(`/api/assessments/${assessmentId}/attempts`).set(auth(student));
  expect(res.status).toBe(201);
  return res.body.submission.id;
};

describe('autosave and deadlines', () => {
  test('answers merge, unknown questions are ignored, and saves after the deadline grace are refused', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { timeLimit: 10 });
    const student = ws.students[0];
    const id = await start(student, quiz.id);

    const save1 = await request(app).patch(`/api/submissions/${id}/answers`).set(auth(student))
      .send({ answers: { mc1: 'Paris', bogus: 'x' } });
    expect(save1.status).toBe(200);
    expect(save1.body.savedAt).toBeTruthy();
    await request(app).patch(`/api/submissions/${id}/answers`).set(auth(student)).send({ answers: { tf1: 'False' } });
    expect((await Submission.findById(id).lean()).answers).toEqual({ mc1: 'Paris', tf1: 'False' });

    // Within the 30 s grace a save still works.
    await Submission.updateOne({ _id: id }, { $set: { deadlineAt: new Date(Date.now() - 10 * 1000) } });
    expect((await request(app).patch(`/api/submissions/${id}/answers`).set(auth(student)).send({ answers: { ms1: ['2'] } })).status).toBe(200);

    // After the grace: 409, and the attempt is auto-submitted with what was saved.
    await Submission.updateOne({ _id: id }, { $set: { deadlineAt: new Date(Date.now() - 60 * 1000) } });
    const late = await request(app).patch(`/api/submissions/${id}/answers`).set(auth(student)).send({ answers: { ms1: ['2', '3'] } });
    expect(late.status).toBe(409);
    const stored = await Submission.findById(id).lean();
    expect(stored.status).toBe('submitted');
    expect(stored.answers.ms1).toEqual(['2']);
    expect(stored.score).toBe(3); // mc1 (2) + tf1 (1)
    expect(stored.submittedAt.getTime()).toBe(stored.deadlineAt.getTime());
  });

  test('submitting after the deadline grades only saved answers', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { timeLimit: 5 });
    const student = ws.students[1];
    const id = await start(student, quiz.id);
    await request(app).patch(`/api/submissions/${id}/answers`).set(auth(student)).send({ answers: { mc1: 'Paris' } });
    await Submission.updateOne({ _id: id }, { $set: { deadlineAt: new Date(Date.now() - 5 * 60 * 1000) } });
    const res = await request(app).post(`/api/submissions/${id}/submit`).set(auth(student))
      .send({ answers: { tf1: 'False', ms1: ['2', '3'] } });
    expect(res.status).toBe(200);
    expect(res.body.lateAnswersRejected).toBe(true);
    expect(res.body.score).toBe(2);
    expect((await request(app).post(`/api/submissions/${id}/submit`).set(auth(student)).send({})).status).toBe(409);
  });
});

describe('integrity events', () => {
  test('violations are counted and the attempt is terminated at maxViolations', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, {
      proctoring: { enabled: true, fullscreen: true, maxViolations: 3 }
    });
    const student = ws.students[2];
    const id = await start(student, quiz.id);
    await request(app).patch(`/api/submissions/${id}/answers`).set(auth(student)).send({ answers: { mc1: 'Paris' } });

    const e1 = await request(app).post(`/api/submissions/${id}/events`).set(auth(student)).send({ type: 'fullscreen_exit' });
    expect(e1.body).toEqual({ violationCount: 1, terminated: false });
    await request(app).post(`/api/submissions/${id}/events`).set(auth(student)).send({ type: 'tab_hidden', detail: 'switched tab' });
    const e3 = await request(app).post(`/api/submissions/${id}/events`).set(auth(student)).send({ type: 'blocked_shortcut', detail: 'Ctrl+C' });
    expect(e3.body).toEqual({ violationCount: 3, terminated: true });

    const stored = await Submission.findById(id).lean();
    expect(stored.status).toBe('terminated');
    expect(stored.integrity.terminated).toBe(true);
    expect(stored.integrity.events.map((e) => e.type)).toEqual(['fullscreen_exit', 'tab_hidden', 'blocked_shortcut']);
    expect(stored.score).toBe(2); // the saved answer was still graded
    expect((await request(app).post(`/api/submissions/${id}/events`).set(auth(student)).send({ type: 'paste' })).status).toBe(409);

    const staffView = await request(app).get(`/api/submissions/${id}`).set(auth(ws.instructor));
    expect(staffView.body.integrity).toMatchObject({ violationCount: 3, terminated: true });
    expect(staffView.body.integrity.events).toHaveLength(3);
  });

  test('the stored event list is capped at 200', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id); // proctoring off: counted, never terminated
    const student = ws.students[3];
    const id = await start(student, quiz.id);
    await Submission.updateOne({ _id: id }, {
      $set: { 'integrity.violationCount': 205, 'integrity.events': Array.from({ length: 200 }, () => ({ type: 'old', at: new Date() })) }
    });
    const res = await request(app).post(`/api/submissions/${id}/events`).set(auth(student)).send({ type: 'paste' });
    expect(res.body).toEqual({ violationCount: 206, terminated: false });
    const stored = await Submission.findById(id).lean();
    expect(stored.integrity.events).toHaveLength(200);
    expect(stored.integrity.events[199].type).toBe('paste');
  });
});

describe('grading', () => {
  test('every question type is graded as defined', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'All types', maxAttempts: 5 });
    const student = ws.students[0];

    const perfect = await takeAssessment(app, student, quiz.id, {
      mc1: 'paris', ms1: ['3', '2'], tf1: false, sa1: '  Logarithmic ', es1: 'Recursion is when a function calls itself on a smaller input until a base case.'
    });
    const byId = Object.fromEntries(perfect.questions.map((q) => [q.id, q.result]));
    expect(byId.mc1).toMatchObject({ isCorrect: true, pointsEarned: 2 });
    expect(byId.ms1).toMatchObject({ isCorrect: true, pointsEarned: 2 });
    expect(byId.tf1).toMatchObject({ isCorrect: true, pointsEarned: 1 });
    expect(byId.sa1).toMatchObject({ isCorrect: true, pointsEarned: 2, needsReview: false });
    expect(byId.es1).toMatchObject({ pointsEarned: 3, needsReview: true });
    expect(perfect).toMatchObject({ score: 10, maxScore: 10, percentage: 100, isPassed: true, needsReview: true });

    const wrong = await takeAssessment(app, student, quiz.id, {
      mc1: 'Rome', ms1: ['2'], tf1: 'True', sa1: 'linear time maybe', es1: 'short'
    });
    const w = Object.fromEntries(wrong.questions.map((q) => [q.id, q.result]));
    expect(w.mc1.pointsEarned).toBe(0);
    expect(w.ms1).toMatchObject({ isCorrect: false, pointsEarned: 0 }); // subset is not the exact set
    expect(w.tf1.pointsEarned).toBe(0);
    expect(w.sa1).toMatchObject({ isCorrect: false, needsReview: true }); // 17 chars → length heuristic
    expect(w.es1).toMatchObject({ pointsEarned: 0, needsReview: true });

    const tfString = await takeAssessment(app, student, quiz.id, { tf1: 'False', ms1: ['2', '3', '4'] });
    const t = Object.fromEntries(tfString.questions.map((q) => [q.id, q.result]));
    expect(t.tf1.isCorrect).toBe(true);
    expect(t.ms1.isCorrect).toBe(false); // superset is not the exact set
    expect(t.es1).toMatchObject({ pointsEarned: 0, needsReview: false }); // blank answers need no review
  });

  test('passing score comes from the assessment', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { passingScore: 80 });
    const result = await takeAssessment(app, ws.students[1], quiz.id, { mc1: 'Paris', ms1: ['2', '3'], tf1: 'False' });
    expect(result.percentage).toBe(50);
    expect(result.isPassed).toBe(false);
  });
});

describe('results policy, release and manual grading', () => {
  test('manual policy hides results until released; showCorrectAnswers controls keys', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { resultsPolicy: 'manual', showCorrectAnswers: false });
    const student = ws.students[2];
    const submitted = await takeAssessment(app, student, quiz.id, { mc1: 'Paris', es1: 'A long essay answer about recursion and base cases.' });
    expect(submitted).toMatchObject({ released: false, status: 'submitted' });
    expect(submitted.percentage).toBeUndefined();

    const mine = await request(app).get('/api/submissions/mine').set(auth(student));
    const row = mine.body.items.find((s) => s.id === submitted.id);
    expect(row).toMatchObject({ released: false, percentage: null });

    // Staff always see the full result, with the real (not yet) release state.
    const staff = await request(app).get(`/api/submissions/${submitted.id}`).set(auth(ws.instructor));
    expect(staff.body.released).toBe(false);
    expect(staff.body.score).toBe(5);
    expect(staff.body.questions[0].correctAnswer).toBe('Paris');

    const release = await request(app).post(`/api/assessments/${quiz.id}/release-results`).set(auth(ws.instructor));
    expect(release.status).toBe(200);
    expect(await Notification.exists({ user: student.id, type: 'results.released' })).toBeTruthy();

    const after = await request(app).get(`/api/submissions/${submitted.id}`).set(auth(student));
    expect(after.body.released).toBe(true);
    expect(after.body.score).toBe(5);
    expect(after.body.questions).toHaveLength(5);
    after.body.questions.forEach((q) => {
      expect(q).not.toHaveProperty('correctAnswer');
      expect(q).not.toHaveProperty('explanation');
      expect(q.result.feedback).not.toMatch(/correct answer is/i);
    });

    await request(app).patch(`/api/assessments/${quiz.id}`).set(auth(ws.instructor)).send({ showCorrectAnswers: true });
    const withKeys = await request(app).get(`/api/submissions/${submitted.id}`).set(auth(student));
    expect(withKeys.body.questions.find((q) => q.id === 'mc1')).toMatchObject({ correctAnswer: 'Paris', explanation: 'Paris is the capital.' });
  });

  test('manual question scores and score override recompute totals, are audited and notify the student', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id);
    const student = ws.students[3];
    const result = await takeAssessment(app, student, quiz.id, { mc1: 'Paris', sa1: 'n log n maybe?', es1: 'x'.repeat(25) });
    expect(result.score).toBe(2 + 1 + 3); // mc1 + sa1 heuristic ceil(2*0.5) + es1 heuristic ceil(3*0.7)

    const graded = await request(app).patch(`/api/submissions/${result.id}/grade`).set(auth(ws.instructor))
      .send({ questionScores: { sa1: 0, es1: 1.5 } });
    expect(graded.status).toBe(200);
    expect(graded.body).toMatchObject({ score: 3.5, maxScore: 10, percentage: 35, isPassed: false, needsReview: false });

    const tooHigh = await request(app).patch(`/api/submissions/${result.id}/grade`).set(auth(ws.instructor))
      .send({ questionScores: { es1: 4 } });
    expect(tooHigh.status).toBe(400);

    const overridden = await request(app).patch(`/api/submissions/${result.id}/grade`).set(auth(ws.instructor))
      .send({ overrideScore: 8, comment: 'Excellent reasoning in the essay' });
    expect(overridden.body).toMatchObject({ score: 8, percentage: 80, isPassed: true });
    expect(overridden.body.override).toMatchObject({ score: 8, comment: 'Excellent reasoning in the essay' });
    expect(overridden.body.aiFeedback.overallFeedback).toMatch(/^Great job! You scored 80% \(8\/10 points\)/);

    const cleared = await request(app).patch(`/api/submissions/${result.id}/grade`).set(auth(ws.instructor))
      .send({ overrideScore: null });
    expect(cleared.body.score).toBe(3.5);
    const commented = await request(app).patch(`/api/submissions/${result.id}/grade`).set(auth(ws.instructor))
      .send({ comment: 'See the rubric for the essay' });
    expect(commented.body).toMatchObject({ score: 3.5, override: { score: null, comment: 'See the rubric for the essay' } });

    expect(await AuditLog.countDocuments({ action: 'submission.grade', targetId: result.id })).toBe(4); // the rejected request is not audited
    expect(await Notification.exists({ user: student.id, type: 'submission.graded' })).toBeTruthy();
    // Students cannot grade.
    expect((await request(app).patch(`/api/submissions/${result.id}/grade`).set(auth(student)).send({ overrideScore: 10 })).status).toBe(403);
  });
});

describe('overall feedback', () => {
  test('matches the final points and says when the score is provisional', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Feedback check' });
    const result = await takeAssessment(app, ws.students[0], quiz.id, { es1: 'A long essay answer about recursion and its base cases.' });
    // The essay earns 3/3 provisional points while no question counts as "correct".
    expect(result).toMatchObject({ score: 3, maxScore: 10, percentage: 30, needsReview: true });
    expect(result.aiFeedback.overallFeedback).toMatch(/You scored 30% \(3\/10 points\)/);
    expect(result.aiFeedback.overallFeedback).toMatch(/provisional/);

    const graded = await request(app).patch(`/api/submissions/${result.id}/grade`).set(auth(ws.instructor))
      .send({ questionScores: { es1: 2 } });
    expect(graded.body.aiFeedback.overallFeedback).toMatch(/You scored 20% \(2\/10 points\)/);
    expect(graded.body.aiFeedback.overallFeedback).not.toMatch(/provisional/);
  });
});

describe('after submit', () => {
  test('plagiarism runs in the background for written answers and instructors get one notification per hour', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Batched' });
    plagiarismService.checkSubmission.mockClear();
    const first = await takeAssessment(app, ws.students[0], quiz.id, { es1: 'Recursion solves a problem by solving smaller copies of itself.' });
    await takeAssessment(app, ws.students[1], quiz.id, { mc1: 'Paris' });
    await whenIdle();

    expect(plagiarismService.checkSubmission).toHaveBeenCalledTimes(1);
    const stored = await Submission.findById(first.id).lean();
    expect(stored.plagiarism).toMatchObject({ isPlagiarismDetected: true, overallSimilarityScore: 0.91 });

    const notes = await Notification.find({ user: ws.instructor.id, type: 'submission.received', link: `/app/assessments/${quiz.id}` }).lean();
    expect(notes).toHaveLength(1);

    const list = await request(app).get(`/api/assessments/${quiz.id}/submissions`).set(auth(ws.instructor));
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.find((s) => s.id === first.id)).toMatchObject({ plagiarismFlag: true, status: 'submitted', violationCount: 0 });
  });
});
