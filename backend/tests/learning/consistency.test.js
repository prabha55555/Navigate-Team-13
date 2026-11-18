const {
  loadApp, connectFresh, disconnect, createWorkspace, createCourse, createAssessment, takeAssessment, auth, request
} = require('./helpers');

jest.mock('../../services/plagiarismService', () => ({
  checkSubmission: jest.fn(async () => ({ isPlagiarismDetected: false, overallSimilarityScore: 0 }))
}));

const { app, connectDB } = loadApp();
const User = require('../../models/User');
const Assessment = require('../../models/Assessment');
const Notification = require('../../models/Notification');
const { roundHalfUp } = require('../../services/scoring');
const { canonicalTopic } = require('../../services/topics');

const mc = (id, points, topic) => ({ id, type: 'multiple-choice', text: `Question ${id}`, options: ['a', 'b'], correctAnswer: 'a', points, topic });

let ws;
let course;
let a1;
let a2;
let x;
let y;
let firstAttemptX;

/*
 * Fixture (passing score 50):
 *   A1 (20 pts): X best 9/20 = 45% (a later attempt scored 0), Y 100%, Z 100% (Z is then deactivated)
 *   A2 (60 pts): X 29/60 = 48.33…%
 * Official basis = best graded attempt per student, current roster only.
 */
beforeAll(async () => {
  await connectFresh(connectDB);
  ws = await createWorkspace({ name: 'Consistency Co', studentCount: 3 });
  [x, y] = ws.students;
  course = await createCourse(app, ws.instructor, ws.students, { topics: ['arrays', 'queues'] });
  a1 = await createAssessment(app, ws.instructor, course.id, {
    title: 'A1', maxAttempts: 2, questions: [mc('q1', 9, 'Arrays'), mc('q2', 11, 'Queue Fundamentals')]
  });
  a2 = await createAssessment(app, ws.instructor, course.id, {
    title: 'A2', questions: [mc('q1', 29, 'Dynamic Arrays and Amortized Analysis'), mc('q2', 31, 'Queues')]
  });
  firstAttemptX = await takeAssessment(app, x, a1.id, { q1: 'a', q2: 'b' });
  await takeAssessment(app, x, a1.id, { q1: 'b', q2: 'b' });
  await takeAssessment(app, x, a2.id, { q1: 'a', q2: 'b' });
  await takeAssessment(app, y, a1.id, { q1: 'a', q2: 'a' });
  await takeAssessment(app, ws.students[2], a1.id, { q1: 'a', q2: 'a' });
  await User.updateOne({ _id: ws.students[2].id }, { $set: { deactivated: true } });
});
afterAll(disconnect);

describe('one scoring basis everywhere', () => {
  test('rounding is half up on the final value', () => {
    expect(roundHalfUp((45 + (29 / 60) * 100) / 2)).toBe(46.7);
    expect(roundHalfUp(46.65)).toBe(46.7);
    expect(roundHalfUp(0.125, 2)).toBe(0.13);
  });

  test('student-level averages agree: gradebook, roster, at-risk', async () => {
    const gb = await request(app).get(`/api/courses/${course.id}/gradebook`).set(auth(ws.instructor));
    expect(gb.body.rows).toHaveLength(2); // deactivated student excluded
    const rowX = gb.body.rows.find((r) => r.student.id === x.id);
    expect(rowX.scores[a1.id].percentage).toBe(45); // best attempt, not the latest (0%)
    expect(rowX.average).toBe(46.7);

    const roster = await request(app).get(`/api/courses/${course.id}/students`).set(auth(ws.instructor));
    expect(roster.body.items.map((s) => s.id).sort()).toEqual([x.id, y.id].sort());
    expect(roster.body.items.find((s) => s.id === x.id)).toMatchObject({ averageScore: 46.7, submissions: 3 });

    const analytics = await request(app).get(`/api/analytics/courses/${course.id}`).set(auth(ws.instructor));
    expect(analytics.body.atRiskStudents.find((s) => s.id === x.id)).toMatchObject({ averageScore: 46.7, gradedAssessments: 2 });
  });

  test('assessment-level averages agree: assessment analytics, course summaries, staff list', async () => {
    const aa = await request(app).get(`/api/analytics/assessments/${a1.id}`).set(auth(ws.instructor));
    expect(aa.body.summary).toMatchObject({ submissions: 2, averageScore: 72.5, passRate: 50, highest: 100, lowest: 45 });

    const ca = await request(app).get(`/api/analytics/courses/${course.id}`).set(auth(ws.instructor));
    expect(ca.body.assessmentSummaries.find((s) => s.id === a1.id)).toMatchObject({ submissions: 2, averageScore: 72.5, passRate: 50, enrolled: 2 });

    const list = await request(app).get(`/api/assessments?courseId=${course.id}`).set(auth(ws.instructor));
    expect(list.body.items.find((a) => a.id === a1.id).averageScore).toBe(72.5);
  });

  test('class-level figures agree: course summary, overview, course list', async () => {
    // Per student: X (45 + 48.33…)/2 = 46.67, Y 100 → class mean 73.3; X is below the pass mark.
    const ca = await request(app).get(`/api/analytics/courses/${course.id}`).set(auth(ws.instructor));
    expect(ca.body.summary).toEqual({ students: 2, gradedStudents: 2, averageScore: 73.3, passRate: 50 });

    const ov = await request(app).get('/api/analytics/overview').set(auth(ws.instructor));
    expect(ov.body).toMatchObject({ averageScore: 73.3, passRate: 50, totals: { students: 2 } });

    const courses = await request(app).get('/api/courses').set(auth(ws.instructor));
    expect(courses.body.items.find((c) => c.id === course.id)).toMatchObject({ averageScore: 73.3, studentCount: 2 });
    const one = await request(app).get(`/api/courses/${course.id}`).set(auth(ws.instructor));
    expect(one.body.studentCount).toBe(2);
  });
});

describe('canonical topics', () => {
  test('matching rules', () => {
    const topics = ['arrays', 'queues', 'Stacks & Queues', 'Complexity Analysis'];
    expect(canonicalTopic('Arrays', topics)).toBe('arrays');
    expect(canonicalTopic('  QUEUES ', topics)).toBe('queues');
    expect(canonicalTopic('Queue Fundamentals', topics)).toBe('queues');
    expect(canonicalTopic('Dynamic Arrays and Amortized Analysis', topics)).toBe('arrays');
    expect(canonicalTopic('Stacks', topics)).toBe('Stacks & Queues');
    expect(canonicalTopic('Hashing  basics', topics)).toBe('Hashing basics');
    expect(canonicalTopic('', topics)).toBe('');
  });

  test('topics are stored canonically for assessments and course bank items', async () => {
    const stored = await Assessment.findById(a2.id).lean();
    expect(stored.questions.map((q) => q.topic)).toEqual(['arrays', 'queues']);
    const bank = await request(app).post('/api/question-bank').set(auth(ws.instructor))
      .send({ courseId: course.id, type: 'true-false', text: 'Queues are FIFO.', correctAnswer: true, topic: 'Queue basics' });
    expect(bank.body.topic).toBe('queues');
  });

  test('result breakdown, feedback, learning path and mastery group by canonical topic', async () => {
    const view = await request(app).get(`/api/submissions/${firstAttemptX.id}`).set(auth(x));
    expect(view.body.topicBreakdown).toEqual([
      { topic: 'queues', pointsEarned: 0, maxPoints: 11, percentage: 0 },
      { topic: 'arrays', pointsEarned: 9, maxPoints: 9, percentage: 100 }
    ]);
    expect(view.body.aiFeedback.overallFeedback).toMatch(/Focus next on queues/);
    expect(new Set(view.body.questions.map((q) => q.topic))).toEqual(new Set(['arrays', 'queues']));

    const path = await request(app).get(`/api/learning-path/${course.id}`).set(auth(x));
    expect(path.body.topics.map((t) => t.topic)).toEqual(['arrays', 'queues']);
    // Best attempts: arrays 9/9 + 29/29, queues 0/11 + 0/31.
    expect(path.body.topics).toEqual([
      expect.objectContaining({ topic: 'arrays', mastery: 100, status: 'mastered' }),
      expect.objectContaining({ topic: 'queues', mastery: 0, status: 'needs-work' })
    ]);
    const me = await request(app).get('/api/analytics/me').set(auth(x));
    expect(me.body.topicMastery).toEqual({ arrays: 100, queues: 0 });
    const heat = await request(app).get(`/api/analytics/courses/${course.id}`).set(auth(ws.instructor));
    expect(heat.body.topicMastery.topics).toEqual(['arrays', 'queues']);
  });
});

describe('release state, notifications and bank usage', () => {
  test('staff see the real release state under the manual policy', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Manual', resultsPolicy: 'manual', questions: [mc('q1', 1, 'arrays')] });
    const r = await takeAssessment(app, x, quiz.id, { q1: 'a' });
    const staff = await request(app).get(`/api/submissions/${r.id}`).set(auth(ws.instructor));
    expect(staff.body).toMatchObject({ released: false, score: 1 });
    await request(app).post(`/api/assessments/${quiz.id}/release-results`).set(auth(ws.instructor));
    expect((await request(app).get(`/api/submissions/${r.id}`).set(auth(ws.instructor))).body.released).toBe(true);
  });

  test('only the first publish announces, and never to deactivated students', async () => {
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Announce once', questions: [mc('q1', 1, 'arrays')] });
    await request(app).post(`/api/assessments/${quiz.id}/unpublish`).set(auth(ws.instructor));
    await request(app).post(`/api/assessments/${quiz.id}/publish`).set(auth(ws.instructor));
    const notes = await Notification.find({ type: 'assessment.published', title: /Announce once/ }).lean();
    expect(notes.map((n) => String(n.user)).sort()).toEqual([x.id, y.id].sort());
  });

  test('a bank question saved from an assessment counts that assessment as a use', async () => {
    const res = await request(app).post('/api/question-bank').set(auth(ws.instructor))
      .send({ courseId: course.id, ...mc(undefined, 2, 'arrays'), text: 'Question q1', id: undefined });
    expect(res.status).toBe(201);
    expect(res.body.usageCount).toBeGreaterThanOrEqual(2); // A1 and A2 both contain "Question q1"
    const list = await request(app).get('/api/question-bank').set(auth(ws.instructor));
    expect(list.body.items.find((i) => i.id === res.body.id).usageCount).toBe(res.body.usageCount);
  });
});
