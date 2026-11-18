const {
  loadApp, connectFresh, disconnect, createWorkspace, auth, request
} = require('./helpers');

const { app, connectDB } = loadApp();
const { cleanTopicList, extractTopicsFromText } = require('../../../ai_services/assessment/topicExtractor');

// Silence the legacy AI modules' console output for these tests.
beforeAll(() => {
  ['log', 'warn', 'error'].forEach((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterAll(() => jest.restoreAllMocks());

const NUMBERED = `CS201 Data Structures
Course description: core data structures in Java.
Topics:
1. Complexity Analysis and Big-O
2. Arrays and Strings
3) Linked Lists
4. Stacks and Queues
5. Linked lists
Grading: 40% exams, 60% projects`;

describe('topic extraction without AI', () => {
  test('numbered list under a heading: numbering trimmed, duplicates removed, next label ends it', () => {
    expect(extractTopicsFromText(NUMBERED)).toEqual([
      'Complexity Analysis and Big-O', 'Arrays and Strings', 'Linked Lists', 'Stacks and Queues'
    ]);
  });

  test('bulleted and plain line-separated lists', () => {
    expect(extractTopicsFromText('Course Topics\n- HTML semantics\n• CSS layout\n* JavaScript basics\n\nAssessment: quizzes'))
      .toEqual(['HTML semantics', 'CSS layout', 'JavaScript basics']);
    expect(extractTopicsFromText('Database Systems.\nModules:\nRelational model\nSQL queries\nTransactions\n'))
      .toEqual(['Relational model', 'SQL queries', 'Transactions']);
    expect(extractTopicsFromText('Topics: arrays, linked lists; trees')).toEqual(['arrays', 'linked lists', 'trees']);
    expect(extractTopicsFromText('Intro\nWeek 1: Sorting\nWeek 2: Searching')).toEqual(['Sorting', 'Searching']);
  });

  test('a single blob item is split; junk, empties and very long lines are dropped', () => {
    expect(cleanTopicList([
      '1. Arrays\n2. Trees\n\n3. Graphs',
      '"keyTopics": []',
      '',
      'x'.repeat(120),
      'trees',
      'Topics:'
    ])).toEqual(['Arrays', 'Trees', 'Graphs']);
  });
});

describe('AI tool endpoints (AI unavailable)', () => {
  let ws;
  beforeAll(async () => {
    await connectFresh(connectDB);
    ws = await createWorkspace({ name: 'AI Tools Co', studentCount: 1 });
  });
  afterAll(disconnect);

  test('analyze-syllabus returns separate, de-numbered topics', async () => {
    const res = await request(app).post('/api/assessment/analyze-syllabus').set(auth(ws.instructor))
      .send({ syllabusContent: NUMBERED });
    expect(res.status).toBe(200);
    expect(res.body.syllabusTopics).toEqual([
      'Complexity Analysis and Big-O', 'Arrays and Strings', 'Linked Lists', 'Stacks and Queues'
    ]);
    expect(res.body.syllabusAnalysis.learningOutcomes.keyTopics.every((t) => !/[\n{}"]/.test(t))).toBe(true);
  });

  test('generate-questions returns text/type alongside question/questionType', async () => {
    const res = await request(app).post('/api/assessment/generate-questions').set(auth(ws.instructor)).send({
      syllabusAnalysis: { basicInfo: { courseTitle: 'CS201' }, learningOutcomes: { keyTopics: ['Trees', 'Graphs'] } },
      pattern: { name: 'Quick', isQuickQuiz: true, structure: [{ questionType: 'Multiple Choice', count: 3 }] }
    });
    expect(res.status).toBe(200);
    expect(res.body.assessment.questions.length).toBeGreaterThan(0);
    res.body.assessment.questions.forEach((q) => {
      expect(q.text).toBeTruthy();
      expect(q.text).toBe(q.question);
      expect(q.type).toBe(q.questionType);
      expect(['multiple-choice', 'multiple-select', 'true-false', 'short-answer', 'essay']).toContain(q.type);
    });
  });

  test('AI tools are staff-only and iterate-quiz is gone', async () => {
    expect((await request(app).get('/api/assessment/templates/default').set(auth(ws.students[0]))).status).toBe(403);
    expect((await request(app).get('/api/assessment/templates/default').set(auth(ws.instructor))).body.templates.length).toBe(5);
    expect((await request(app).post('/api/assessment/iterate-quiz').set(auth(ws.instructor)).send({})).status).toBe(404);
  });
});
