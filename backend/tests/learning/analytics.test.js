const {
  loadApp, connectFresh, disconnect, createWorkspace, createCourse, createAssessment, takeAssessment, auth, request
} = require('./helpers');

jest.mock('../../services/plagiarismService', () => ({
  checkSubmission: jest.fn(async () => ({ isPlagiarismDetected: false, overallSimilarityScore: 0 }))
}));

const { app, connectDB } = loadApp();
const Organization = require('../../models/Organization');
const Assessment = require('../../models/Assessment');
const { itemAnalysis, scoreDistribution, streakDays } = require('../../services/analyticsService');

beforeAll(() => connectFresh(connectDB));
afterAll(disconnect);

describe('item analysis math', () => {
  const questions = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => ({ id, text: id, type: 'multiple-choice', points: 1 }));
  // [percentage, q1..q5 points earned]
  const table = [
    [100, 1, 1, 1, 0, 1],
    [67, 1, 1, 0, 0, 0],
    [67, 1, 0, 1, 0, 0],
    [33, 1, 0, 0, 1, 1],
    [33, 1, 0, 0, 0, 1],
    [33, 1, 0, 0, 0, 1]
  ];
  const submissions = table.map(([percentage, ...pts]) => ({
    percentage,
    questionResults: pts.map((p, i) => ({ questionId: `q${i + 1}`, pointsEarned: p, maxPoints: 1 }))
  }));

  test('difficulty, discrimination (top vs bottom 27%) and flags', () => {
    const items = Object.fromEntries(itemAnalysis(questions, submissions).map((i) => [i.questionId, i]));
    // n = 6 → groups of round(6 * 0.27) = 2: upper = first two rows, lower = last two rows.
    expect(items.q1).toMatchObject({ difficultyIndex: 1, discriminationIndex: 0, flag: 'too-easy', averagePoints: 1 });
    expect(items.q2).toMatchObject({ difficultyIndex: 0.33, discriminationIndex: 1, flag: null });
    expect(items.q3).toMatchObject({ difficultyIndex: 0.33, discriminationIndex: 0.5, flag: null });
    expect(items.q4).toMatchObject({ difficultyIndex: 0.17, discriminationIndex: 0, flag: 'too-hard' });
    expect(items.q5).toMatchObject({ difficultyIndex: 0.67, discriminationIndex: -0.5, flag: 'poor-discrimination' });
  });

  test('flags use the reported (rounded) values', () => {
    // 3/5 − 2/5 is 0.19999999999999996 in floating point but is reported as 0.2: not "poor".
    const q = [{ id: 'e', text: 'edge', type: 'short-answer', points: 5 }];
    const subs = [3, 3, 3, 2, 2].map((pts, i) => ({
      percentage: 100 - i * 10,
      questionResults: [{ questionId: 'e', pointsEarned: pts, maxPoints: 5 }]
    }));
    expect(itemAnalysis(q, subs)[0]).toMatchObject({ difficultyIndex: 0.52, discriminationIndex: 0.2, flag: null });
  });

  test('fewer than 5 submissions → null indexes', () => {
    const items = itemAnalysis(questions, submissions.slice(0, 4));
    items.forEach((i) => expect(i).toMatchObject({ difficultyIndex: null, discriminationIndex: null, flag: null }));
  });

  test('score distribution buckets and streaks', () => {
    const dist = scoreDistribution([0, 9.9, 10, 55, 90, 100]);
    expect(dist).toHaveLength(10);
    expect(dist[0]).toEqual({ bucket: '0-9', count: 2 });
    expect(dist[1].count).toBe(1);
    expect(dist[5].count).toBe(1);
    expect(dist[9]).toEqual({ bucket: '90-100', count: 2 });
    const now = new Date('2026-03-10T12:00:00Z');
    expect(streakDays([new Date('2026-03-09T08:00:00Z'), new Date('2026-03-08T08:00:00Z'), new Date('2026-03-06T08:00:00Z')], now)).toBe(2);
    expect(streakDays([], now)).toBe(0);
  });
});

describe('analytics endpoints, learning path and practice', () => {
  let ws;
  let course;
  let quiz;
  beforeAll(async () => {
    ws = await createWorkspace({ name: 'Analytics Co', studentCount: 6 });
    course = await createCourse(app, ws.instructor, ws.students, { topics: ['Geography', 'Math', 'Algorithms', 'Unseen'] });
    quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Analysed quiz' });
    const perfect = { mc1: 'Paris', ms1: ['2', '3'], tf1: 'False', sa1: 'O(log n)', es1: 'r'.repeat(60) };
    // Students 0-4 answer everything right except a varying number of items; student 5 does badly.
    await takeAssessment(app, ws.students[0], quiz.id, perfect);
    await takeAssessment(app, ws.students[1], quiz.id, { ...perfect, es1: '' });
    await takeAssessment(app, ws.students[2], quiz.id, { ...perfect, sa1: '', es1: '' });
    await takeAssessment(app, ws.students[3], quiz.id, { mc1: 'Paris', ms1: ['2', '3'], tf1: 'False' });
    await takeAssessment(app, ws.students[4], quiz.id, { mc1: 'Paris', tf1: 'True' });
    // Student 5: Geography 2/3 (mc right, tf wrong), Math full, Algorithms 0.
    await takeAssessment(app, ws.students[5], quiz.id, { mc1: 'Paris', ms1: ['2', '3'], tf1: 'True', sa1: 'no idea' });
    // A second, failed assessment makes student 5 at risk (average < 50% over 2 assessments).
    const second = await createAssessment(app, ws.instructor, course.id, { title: 'Second quiz' });
    await takeAssessment(app, ws.students[5], second.id, { mc1: 'Rome' });
    // Unreleased manual-policy results must not leak into the student's mastery.
    const hidden = await createAssessment(app, ws.instructor, course.id, { title: 'Hidden', resultsPolicy: 'manual' });
    await takeAssessment(app, ws.students[5], hidden.id, { mc1: 'Paris', ms1: ['2', '3'], tf1: 'False', sa1: 'O(log n)', es1: 'r'.repeat(60) });
  });

  test('assessment analytics', async () => {
    const res = await request(app).get(`/api/analytics/assessments/${quiz.id}`).set(auth(ws.instructor));
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ submissions: 6, attempts: 6, highest: 100 });
    expect(res.body.distribution).toHaveLength(10);
    const mc1 = res.body.items.find((i) => i.questionId === 'mc1');
    expect(mc1).toMatchObject({ difficultyIndex: 1, flag: 'too-easy', averagePoints: 2, topic: 'Geography' });
    res.body.items.forEach((i) => {
      expect(i.difficultyIndex).toBeGreaterThanOrEqual(0);
      expect(i.difficultyIndex).toBeLessThanOrEqual(1);
      expect(i.discriminationIndex).toBeGreaterThanOrEqual(-1);
      expect(i.discriminationIndex).toBeLessThanOrEqual(1);
    });
    expect(res.body.integrity).toEqual({ flagged: 0, terminated: 0, averageViolations: 0 });
  });

  test('course analytics: topic mastery heatmap, summaries, distribution', async () => {
    const res = await request(app).get(`/api/analytics/courses/${course.id}`).set(auth(ws.instructor));
    expect(res.status).toBe(200);
    expect(res.body.topicMastery.topics).toEqual(['Geography', 'Math', 'Algorithms', 'Unseen']);
    const s5 = res.body.topicMastery.students.find((s) => s.id === ws.students[5].id);
    // Instructors see all graded work, including the unreleased "Hidden" quiz.
    expect(s5.mastery.Unseen).toBeNull();
    expect(res.body.assessmentSummaries.map((a) => a.title)).toEqual(expect.arrayContaining(['Analysed quiz', 'Second quiz']));
    expect(res.body.scoreDistribution.reduce((n, b) => n + b.count, 0)).toBe(8);
    expect(res.body.atRiskStudents.map((s) => s.id)).toContain(ws.students[5].id);
  });

  test('overview for staff', async () => {
    const res = await request(app).get('/api/analytics/overview').set(auth(ws.instructor));
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ courses: 1, students: 6, assessments: 3, submissions30d: 8 });
    expect(res.body.trend).toHaveLength(8);
    expect(res.body.trend[7].submissions).toBe(8);
    const risk = res.body.atRiskStudents.find((s) => s.id === ws.students[5].id);
    expect(risk).toMatchObject({ courseId: course.id, reasons: ['low-average'], gradedAssessments: 3 });
    expect(res.body.recentSubmissions).toHaveLength(8);
    expect(typeof res.body.passRate).toBe('number');
    // The other instructor teaches nothing yet.
    const empty = await request(app).get('/api/analytics/overview').set(auth(ws.instructor2));
    expect(empty.body.totals).toMatchObject({ courses: 0, students: 0 });
    expect((await request(app).get('/api/analytics/overview').set(auth(ws.students[0]))).status).toBe(403);
  });

  test('student analytics', async () => {
    const res = await request(app).get('/api/analytics/me').set(auth(ws.students[5]));
    expect(res.status).toBe(200);
    expect(res.body.courses[0]).toMatchObject({ id: course.id, completed: 3, total: 3 });
    expect(res.body.topicMastery.Math).toBe(50); // quiz 1: 2/2, quiz 2: 0/2; the hidden quiz is excluded
    expect(res.body.streakDays).toBeGreaterThanOrEqual(1);
    const hiddenRow = res.body.recent.find((r) => r.assessment.title === 'Hidden');
    expect(hiddenRow).toMatchObject({ released: false, percentage: null });
  });

  test('learning path statuses, level and fallback recommendations', async () => {
    const res = await request(app).get(`/api/learning-path/${course.id}`).set(auth(ws.students[5]));
    expect(res.status).toBe(200);
    const topics = Object.fromEntries(res.body.topics.map((t) => [t.topic, t]));
    // Geography: quiz 1 mc 2/2 + tf 0/1, quiz 2 mc 0/2 + tf 0/1 → 2/6
    expect(topics.Geography).toMatchObject({ mastery: 33.3, status: 'needs-work', attempts: 4 });
    expect(topics.Math).toMatchObject({ mastery: 50, status: 'developing' });
    expect(topics.Algorithms).toMatchObject({ mastery: 0, status: 'needs-work' });
    expect(topics.Unseen).toMatchObject({ mastery: null, status: 'not-assessed', attempts: 0 });
    expect(res.body.level).toBe('beginner');
    expect(res.body.recommendations.map((r) => r.topic)).toEqual(['Algorithms', 'Geography', 'Math']);
    res.body.recommendations.forEach((r) => {
      expect(r.source).toBe('template');
      expect(r.tips.length).toBeGreaterThan(0);
      expect(r.resources.length).toBeGreaterThan(0);
    });

    const best = await request(app).get(`/api/learning-path/${course.id}`).set(auth(ws.students[0]));
    expect(Object.fromEntries(best.body.topics.map((t) => [t.topic, t.status]))).toMatchObject({
      Geography: 'mastered', Math: 'mastered', Algorithms: 'mastered', Unseen: 'not-assessed'
    });
    expect(best.body.level).toBe('advanced');
    expect((await request(app).get(`/api/learning-path/${course.id}`).set(auth(ws.instructor))).status).toBe(403);
  });

  test('practice quiz with AI unavailable uses past-assessment questions, is private and excluded from grading views', async () => {
    await request(app).post(`/api/assessments/${quiz.id}/close`).set(auth(ws.instructor));
    const student = ws.students[5];
    const res = await request(app).post(`/api/learning-path/${course.id}/practice`).set(auth(student)).send({ questionCount: 5 });
    expect(res.status).toBe(201);
    expect(res.body.generatedBy).toBe('fallback');
    expect(res.body.topics).toEqual(['Algorithms', 'Geography', 'Math']);

    const practice = await Assessment.findById(res.body.assessmentId).lean();
    expect(practice).toMatchObject({
      isPractice: true, status: 'published', resultsPolicy: 'immediate', showCorrectAnswers: true, source: 'practice'
    });
    expect(String(practice.practiceFor)).toBe(student.id);
    expect(practice.proctoring.enabled).toBe(false);
    expect(practice.questions).toHaveLength(5);
    // Objective questions came from the closed quiz; written topics get a reflection prompt.
    expect(practice.questions.some((q) => q.text === 'Capital of France?')).toBe(true);
    // The AI generation is refunded when the fallback was used.
    expect((await Organization.findById(ws.orgId).lean()).usage.aiGenerations).toBe(0);

    // Take it: results and keys are shown immediately.
    const answers = Object.fromEntries(practice.questions.map((q) => [q.id, q.correctAnswer]));
    const result = await takeAssessment(app, student, res.body.assessmentId, answers);
    expect(result.released).toBe(true);
    expect(result.questions[0]).toHaveProperty('correctAnswer');

    // Private to the student; invisible to staff lists, gradebook and analytics.
    expect((await request(app).get(`/api/assessments/${res.body.assessmentId}`).set(auth(ws.students[0]))).status).toBe(404);
    const mine = await request(app).get(`/api/assessments?courseId=${course.id}&practice=true`).set(auth(student));
    expect(mine.body.items.map((a) => a.id)).toEqual([res.body.assessmentId]);
    const staffList = await request(app).get(`/api/assessments?courseId=${course.id}`).set(auth(ws.instructor));
    expect(staffList.body.items.find((a) => a.id === res.body.assessmentId)).toBeUndefined();
    const gb = await request(app).get(`/api/courses/${course.id}/gradebook`).set(auth(ws.instructor));
    expect(gb.body.assessments.find((a) => a.id === res.body.assessmentId)).toBeUndefined();
    const overview = await request(app).get('/api/analytics/overview').set(auth(ws.instructor));
    expect(overview.body.totals.submissions30d).toBe(8);

    // ?practice=true|false filters "my submissions"; without it both kinds are listed.
    const onlyPractice = await request(app).get('/api/submissions/mine?practice=true').set(auth(student));
    expect(onlyPractice.body.items.map((s) => s.id)).toEqual([result.id]);
    const noPractice = await request(app).get('/api/submissions/mine?practice=false').set(auth(student));
    expect(noPractice.body.items.every((s) => !s.isPractice)).toBe(true);
    expect(noPractice.body.total).toBe(3);
    expect((await request(app).get('/api/submissions/mine').set(auth(student))).body.total).toBe(4);

    const bad = await request(app).post(`/api/learning-path/${course.id}/practice`).set(auth(student)).send({ topics: ['Cooking'] });
    expect(bad.status).toBe(400);
  });

  test('practice quiz respects the AI quota', async () => {
    await Organization.updateOne({ _id: ws.orgId }, { $set: { plan: 'free', 'usage.period': new Date().toISOString().slice(0, 7), 'usage.aiGenerations': 25 } });
    const res = await request(app).post(`/api/learning-path/${course.id}/practice`).set(auth(ws.students[1])).send({});
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PLAN_LIMIT');
  });
});

describe('student upcoming work and practice top-up', () => {
  let ws;
  let course;
  beforeAll(async () => {
    ws = await createWorkspace({ name: 'Upcoming Co', studentCount: 1 });
    course = await createCourse(app, ws.instructor, ws.students, { topics: ['Recursion', 'Sorting'] });
  });

  test('upcoming lists work the student can still start or resume, by due date', async () => {
    const student = ws.students[0];
    const day = 24 * 60 * 60 * 1000;
    const due = (d) => new Date(Date.now() + d * day).toISOString();
    const retry = await createAssessment(app, ws.instructor, course.id, { title: 'Second attempt open', maxAttempts: 2, dueDate: due(3) });
    await takeAssessment(app, student, retry.id, { mc1: 'Paris' });
    const used = await createAssessment(app, ws.instructor, course.id, { title: 'All attempts used', dueDate: due(2) });
    await takeAssessment(app, student, used.id, {});
    const resume = await createAssessment(app, ws.instructor, course.id, { title: 'In progress', dueDate: due(5) });
    await request(app).post(`/api/assessments/${resume.id}/attempts`).set(auth(student));
    const fresh = await createAssessment(app, ws.instructor, course.id, { title: 'Not started', dueDate: due(1) });
    const noDue = await createAssessment(app, ws.instructor, course.id, { title: 'No due date' });
    await createAssessment(app, ws.instructor, course.id, { title: 'Past due', dueDate: due(-1) });
    await createAssessment(app, ws.instructor, course.id, { title: 'Draft' }, { publish: false });

    const res = await request(app).get('/api/analytics/me').set(auth(student));
    expect(res.body.upcoming.map((u) => u.id)).toEqual([fresh.id, retry.id, resume.id, noDue.id]);
    expect(res.body.upcoming.find((u) => u.id === retry.id)).toMatchObject({ attempts: 1, attemptsRemaining: 1, inProgress: false });
    expect(res.body.upcoming.find((u) => u.id === resume.id)).toMatchObject({ attempts: 0, inProgress: true });
  });

  test('fallback practice is topped up to the requested size from the bank and prompts, never from live assessments', async () => {
    const student = ws.students[0];
    await request(app).post('/api/question-bank').set(auth(ws.instructor)).send({
      courseId: course.id,
      items: [
        { type: 'true-false', text: 'Every recursive function needs a base case.', correctAnswer: true, topic: 'Recursion', tags: ['Practice'] },
        { type: 'multiple-choice', text: 'Which sort is stable?', options: ['Merge sort', 'Heap sort'], correctAnswer: 'Merge sort', topic: 'Sorting', tags: ['practice', 'week3'] },
        { type: 'multiple-choice', text: 'Off-topic bank question', options: ['a', 'b'], correctAnswer: 'a', topic: 'Other', tags: ['PRACTICE'] },
        { type: 'essay', text: 'Bank essay without key', topic: 'Recursion', tags: ['practice'] },
        // Not opted in: private exam questions must never reach students.
        { type: 'true-false', text: 'PRIVATE exam question on recursion', correctAnswer: true, topic: 'Recursion', tags: ['final-exam'] },
        { type: 'true-false', text: 'Untagged bank question on sorting', correctAnswer: false, topic: 'Sorting' }
      ]
    });
    await createAssessment(app, ws.instructor, course.id, {
      title: 'Live quiz',
      questions: [{ type: 'true-false', text: 'LIVE QUESTION about recursion', correctAnswer: 'True', topic: 'Recursion' }]
    });

    const res = await request(app).post(`/api/learning-path/${course.id}/practice`).set(auth(student))
      .send({ topics: ['Recursion', 'Sorting'], questionCount: 12 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ generatedBy: 'fallback', questionCount: 12, topics: ['Recursion', 'Sorting'] });

    const practice = await Assessment.findById(res.body.assessmentId).lean();
    const texts = practice.questions.map((q) => q.text);
    expect(new Set(texts).size).toBe(12);
    // On-topic `practice`-tagged bank questions first, then other tagged ones, then the past-due quiz
    // (its 4 auto-gradable questions), then prompts covering every topic.
    expect(texts.slice(0, 2).sort()).toEqual(['Every recursive function needs a base case.', 'Which sort is stable?']);
    expect(texts[2]).toBe('Off-topic bank question');
    expect(texts.slice(3, 7).sort()).toEqual(['Big-O of binary search?', 'Capital of France?', 'Pick the primes', 'The earth is flat.']);
    expect(texts).not.toContain('LIVE QUESTION about recursion');
    expect(texts).not.toContain('Bank essay without key');
    expect(texts).not.toContain('PRIVATE exam question on recursion');
    expect(texts).not.toContain('Untagged bank question on sorting');
    expect(texts).not.toContain('Explain recursion.'); // essays without a key are not reused
    const prompts = practice.questions.slice(7);
    expect(new Set(prompts.map((q) => q.topic))).toEqual(new Set(['Recursion', 'Sorting']));
    prompts.forEach((q) => expect(['short-answer', 'essay']).toContain(q.type));
  });
});
