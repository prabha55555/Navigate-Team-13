const {
  loadApp, connectFresh, disconnect, createWorkspace, createCourse, createAssessment, takeAssessment, auth, request
} = require('./helpers');

jest.mock('../../services/plagiarismService', () => ({
  checkSubmission: jest.fn(async () => ({ isPlagiarismDetected: false, overallSimilarityScore: 0 }))
}));

const { app, connectDB } = loadApp();

let ws;
let other;
beforeAll(async () => {
  await connectFresh(connectDB);
  ws = await createWorkspace({ name: 'Course Co', studentCount: 4 });
  other = await createWorkspace({ name: 'Other Co', studentCount: 1 });
});
afterAll(disconnect);

describe('course CRUD', () => {
  test('instructor creates, reads, updates and the owner archives a course', async () => {
    const created = await request(app).post('/api/courses').set(auth(ws.instructor))
      .send({ title: 'Data Structures', code: 'CS201', topics: ['Arrays', 'Trees', 'Arrays', ''] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Data Structures', code: 'CS201', topics: ['Arrays', 'Trees'], archived: false });
    expect(created.body.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(created.body.instructors.map((i) => i.id)).toEqual([ws.instructor.id]);

    const id = created.body.id;
    const patched = await request(app).patch(`/api/courses/${id}`).set(auth(ws.instructor)).send({
      description: 'Core CS',
      outcomes: [{ code: 'LO1', description: 'Analyse algorithms', bloomLevel: 'Analyze' }]
    });
    expect(patched.status).toBe(200);
    expect(patched.body.description).toBe('Core CS');
    expect(patched.body.outcomes[0]).toMatchObject({ code: 'LO1', description: 'Analyse algorithms' });
    expect(patched.body.outcomes[0].id).toBeTruthy();

    // Curriculum links must reference this course's assessments and known outcomes.
    const assessment = await createAssessment(app, ws.instructor, id, {}, { publish: false });
    const linked = await request(app).patch(`/api/courses/${id}`).set(auth(ws.instructor))
      .send({ curriculumMap: { links: [{ outcomeId: patched.body.outcomes[0].id, assessmentId: assessment.id }] } });
    expect(linked.status).toBe(200);
    expect(linked.body.curriculumMap.links).toHaveLength(1);
    const badLink = await request(app).patch(`/api/courses/${id}`).set(auth(ws.instructor))
      .send({ curriculumMap: { links: [{ outcomeId: 'nope', assessmentId: assessment.id }] } });
    expect(badLink.status).toBe(400);

    // Only owner/admin can archive (DELETE).
    expect((await request(app).delete(`/api/courses/${id}`).set(auth(ws.instructor))).status).toBe(403);
    expect((await request(app).delete(`/api/courses/${id}`).set(auth(ws.owner))).status).toBe(200);
    const list = await request(app).get('/api/courses').set(auth(ws.owner));
    expect(list.body.items.find((c) => c.id === id)).toBeUndefined();
    const archived = await request(app).get('/api/courses?archived=true').set(auth(ws.owner));
    expect(archived.body.items.find((c) => c.id === id)).toBeTruthy();
  });

  test('students cannot create courses; other instructors cannot manage a course they do not teach', async () => {
    expect((await request(app).post('/api/courses').set(auth(ws.students[0])).send({ title: 'x' })).status).toBe(403);
    const course = await createCourse(app, ws.instructor);
    expect((await request(app).patch(`/api/courses/${course.id}`).set(auth(ws.instructor2)).send({ title: 'Hijack' })).status).toBe(403);
    const list = await request(app).get('/api/courses').set(auth(ws.instructor2));
    expect(list.body.items.find((c) => c.id === course.id)).toBeUndefined();
    // Owner sees every course in the workspace.
    const ownerList = await request(app).get('/api/courses').set(auth(ws.owner));
    expect(ownerList.body.items.find((c) => c.id === course.id)).toBeTruthy();
  });

  test('owner adds a co-instructor who can then manage the course', async () => {
    const course = await createCourse(app, ws.instructor);
    const added = await request(app).post(`/api/courses/${course.id}/instructors`).set(auth(ws.owner))
      .send({ userId: ws.instructor2.id });
    expect(added.status).toBe(200);
    expect(added.body.instructors.map((i) => i.id)).toEqual(expect.arrayContaining([ws.instructor.id, ws.instructor2.id]));
    expect((await request(app).patch(`/api/courses/${course.id}`).set(auth(ws.instructor2)).send({ term: 'Fall' })).status).toBe(200);
    // A student cannot be made instructor.
    const bad = await request(app).post(`/api/courses/${course.id}/instructors`).set(auth(ws.owner)).send({ userId: ws.students[0].id });
    expect(bad.status).toBe(404);
  });
});

describe('join code and roster', () => {
  test('student joins by code; regenerating invalidates the old code; disabled codes are rejected', async () => {
    const course = await createCourse(app, ws.instructor);
    const student = ws.students[0];
    const joined = await request(app).post('/api/courses/join').set(auth(student)).send({ code: course.joinCode.toLowerCase() });
    expect(joined.status).toBe(200);
    expect(joined.body.course.id).toBe(course.id);
    expect(joined.body.course.joinCode).toBeUndefined(); // students never see the join code
    const again = await request(app).post('/api/courses/join').set(auth(student)).send({ code: course.joinCode });
    expect(again.body.alreadyEnrolled).toBe(true);

    const mine = await request(app).get('/api/courses').set(auth(student));
    const item = mine.body.items.find((c) => c.id === course.id);
    expect(item.progress).toEqual({ completed: 0, total: 0, averageScore: null });
    expect(item.joinCode).toBeUndefined();

    const regen = await request(app).post(`/api/courses/${course.id}/join-code/regenerate`).set(auth(ws.instructor));
    expect(regen.status).toBe(200);
    expect(regen.body.joinCode).not.toBe(course.joinCode);
    expect((await request(app).post('/api/courses/join').set(auth(ws.students[1])).send({ code: course.joinCode })).status).toBe(404);

    await request(app).patch(`/api/courses/${course.id}`).set(auth(ws.instructor)).send({ joinCodeEnabled: false });
    expect((await request(app).post('/api/courses/join').set(auth(ws.students[1])).send({ code: regen.body.joinCode })).status).toBe(404);
  });

  test('a join code from another workspace does not work', async () => {
    const course = await createCourse(app, ws.instructor);
    const res = await request(app).post('/api/courses/join').set(auth(other.students[0])).send({ code: course.joinCode });
    expect(res.status).toBe(404);
  });

  test('roster add by email, list, and remove', async () => {
    const course = await createCourse(app, ws.instructor);
    const res = await request(app).post(`/api/courses/${course.id}/students`).set(auth(ws.instructor))
      .send({ emails: [ws.students[0].email, ws.students[1].email.toUpperCase(), 'nobody@example.com', other.students[0].email] });
    expect(res.status).toBe(200);
    expect(res.body.added.sort()).toEqual([ws.students[0].email, ws.students[1].email].sort());
    expect(res.body.notFound).toEqual(['nobody@example.com', other.students[0].email]);

    const roster = await request(app).get(`/api/courses/${course.id}/students`).set(auth(ws.instructor));
    expect(roster.body.items).toHaveLength(2);
    expect(roster.body.items[0]).toEqual(expect.objectContaining({
      id: expect.any(String), name: expect.any(String), email: expect.any(String), averageScore: null, submissions: 0
    }));

    const removed = await request(app).delete(`/api/courses/${course.id}/students/${ws.students[0].id}`).set(auth(ws.instructor));
    expect(removed.status).toBe(200);
    expect((await request(app).get(`/api/courses/${course.id}`).set(auth(ws.students[0]))).status).toBe(404);
    // Removed students cannot rejoin by code on their own.
    expect((await request(app).post('/api/courses/join').set(auth(ws.students[0])).send({ code: course.joinCode })).status).toBe(403);
  });
});

describe('tenant isolation', () => {
  test('another workspace gets 404 for a course, its roster and gradebook', async () => {
    const course = await createCourse(app, ws.instructor, [ws.students[0]]);
    const outsider = other.owner;
    expect((await request(app).get(`/api/courses/${course.id}`).set(auth(outsider))).status).toBe(404);
    expect((await request(app).patch(`/api/courses/${course.id}`).set(auth(outsider)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).get(`/api/courses/${course.id}/students`).set(auth(outsider))).status).toBe(404);
    expect((await request(app).get(`/api/courses/${course.id}/gradebook`).set(auth(outsider))).status).toBe(404);
    expect((await request(app).get('/api/courses/not-an-id').set(auth(outsider))).status).toBe(404);
  });
});

describe('gradebook', () => {
  test('JSON and CSV export with escaping and BOM; practice quizzes are excluded', async () => {
    const [a, b] = ws.students;
    const course = await createCourse(app, ws.instructor, [a, b], { title: 'Gradebook 101', topics: ['Geography', 'Math', 'Algorithms'] });
    const quiz = await createAssessment(app, ws.instructor, course.id, { title: 'Quiz, "one"' });
    await takeAssessment(app, a, quiz.id, { mc1: 'Paris', ms1: ['2', '3'], tf1: false, sa1: 'O(log n)', es1: 'x'.repeat(60) });

    // A practice quiz taken by student A must not show up as a column.
    const practice = await request(app).post(`/api/learning-path/${course.id}/practice`).set(auth(a)).send({});
    expect(practice.status).toBe(201);

    const gb = await request(app).get(`/api/courses/${course.id}/gradebook`).set(auth(ws.instructor));
    expect(gb.status).toBe(200);
    expect(gb.body.assessments.map((x) => x.id)).toEqual([quiz.id]);
    const rowA = gb.body.rows.find((r) => r.student.id === a.id);
    const rowB = gb.body.rows.find((r) => r.student.id === b.id);
    expect(rowA.scores[quiz.id]).toMatchObject({ status: 'submitted', percentage: 100 });
    expect(rowA.average).toBe(100);
    expect(rowB.scores[quiz.id]).toMatchObject({ status: 'not-started', percentage: null, submissionId: null });

    const csv = await request(app).get(`/api/courses/${course.id}/gradebook.csv`).set(auth(ws.instructor));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toMatch(/attachment; filename="C101-gradebook.csv"/);
    expect(csv.text.charCodeAt(0)).toBe(0xFEFF);
    const lines = csv.text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Student,Email,"Quiz, ""one"" (%)",Average (%)');
    expect(lines).toContain(`${a.name},${a.email},100,100`);
    expect(lines).toContain(`${b.name},${b.email},,`);
  });

  test('CSV fields that look like formulas are neutralised', () => {
    const { csvField } = require('../../services/gradebookService');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('-12.5')).toBe('-12.5');
    expect(csvField('a\nb')).toBe('"a\nb"');
  });
});
