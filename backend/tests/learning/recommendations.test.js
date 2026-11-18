const {
  loadApp, connectFresh, disconnect, createWorkspace, createCourse, createAssessment, takeAssessment, auth, request
} = require('./helpers');

// AI is "configured" but answers only when the test releases it.
let releaseAi;
let failAi;
jest.mock('../../services/curriculumService', () => {
  const actual = jest.requireActual('../../services/curriculumService');
  return {
    ...actual,
    isAiConfigured: () => true,
    generateText: jest.fn(() => new Promise((resolve, reject) => { releaseAi = resolve; failAi = reject; }))
  };
});
jest.mock('../../services/plagiarismService', () => ({
  checkSubmission: jest.fn(async () => ({ isPlagiarismDetected: false, overallSimilarityScore: 0 }))
}));
jest.mock('../../../ai_services/models/transformersModel', () => ({
  createChatCompletion: jest.fn(async () => [
    'Q: Which structure is FIFO?', 'Type: multiple-choice', 'A: Queue', 'B: Stack', 'C: Tree', 'D: Graph',
    'Correct: A', 'Points: 1', 'Topic: Queues', 'END',
    'Q: A stack is LIFO.', 'Type: true-false', 'Options: True/False', 'Correct: True',
    'Explanation: The last pushed item is popped first.', 'Points: 1', 'Topic: Stacks', 'END'
  ].join('\n'))
}));

const { app, connectDB } = loadApp();
const curriculumService = require('../../services/curriculumService');
const learningPath = require('../../services/learningPathService');
const syllabusAnalyzer = require('../../../ai_services/assessment/syllabusAnalyzer');

let ws;
let course;
beforeAll(async () => {
  await connectFresh(connectDB);
  ws = await createWorkspace({ name: 'Recs Co', studentCount: 2 });
  course = await createCourse(app, ws.instructor, ws.students, { topics: ['Geography', 'Math', 'Algorithms'] });
  const quiz = await createAssessment(app, ws.instructor, course.id);
  await takeAssessment(app, ws.students[0], quiz.id, { mc1: 'Rome' });
  await takeAssessment(app, ws.students[1], quiz.id, { mc1: 'Rome', ms1: ['2'] });
});
afterAll(async () => {
  await learningPath.whenIdle();
  await disconnect();
});

describe('learning path recommendations never wait for AI', () => {
  test('first visit returns templates as pending; AI result is served once ready', async () => {
    const student = ws.students[0];
    const started = Date.now();
    const first = await request(app).get(`/api/learning-path/${course.id}`).set(auth(student));
    expect(Date.now() - started).toBeLessThan(1500);
    expect(first.body.recommendationsStatus).toBe('pending');
    expect(first.body.recommendations.every((r) => r.source === 'template')).toBe(true);
    expect(first.body.topics.length).toBeGreaterThan(0);

    // Re-fetch while pending: still pending, and no second AI call is started.
    const again = await request(app).get(`/api/learning-path/${course.id}`).set(auth(student));
    expect(again.body.recommendationsStatus).toBe('pending');
    expect(curriculumService.generateText).toHaveBeenCalledTimes(1);

    const focus = first.body.recommendations.map((r) => r.topic);
    releaseAi(JSON.stringify(focus.map((topic) => ({ topic, tips: [`Practise ${topic} daily`], resources: [{ title: `${topic} video`, type: 'video' }] }))));
    await learningPath.whenIdle();

    const ready = await request(app).get(`/api/learning-path/${course.id}`).set(auth(student));
    expect(ready.body.recommendationsStatus).toBe('ai');
    expect(ready.body.recommendations[0]).toMatchObject({ source: 'ai', tips: [`Practise ${focus[0]} daily`] });
  });

  test('a failed AI call is served as fallback', async () => {
    const student = ws.students[1];
    const first = await request(app).get(`/api/learning-path/${course.id}`).set(auth(student));
    expect(first.body.recommendationsStatus).toBe('pending');
    failAi(new Error('Gemini request timed out'));
    await learningPath.whenIdle();
    const after = await request(app).get(`/api/learning-path/${course.id}`).set(auth(student));
    expect(after.body.recommendationsStatus).toBe('fallback');
    expect(after.body.recommendations.every((r) => r.source === 'template')).toBe(true);
  });
});

describe('AI-generated questions', () => {
  test('carry only the model\'s own explanation, never a template one', async () => {
    const quiz = await syllabusAnalyzer.generateQuickQuiz(
      { basicInfo: { courseTitle: 'CS' }, learningOutcomes: { keyTopics: ['Queues', 'Stacks'] } },
      { questionCount: 2 }
    );
    expect(quiz.generatedBy).toBe('gemini');
    expect(quiz.questions.map((q) => q.explanation)).toEqual(['', 'The last pushed item is popped first.']);
  });
});
