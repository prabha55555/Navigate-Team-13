/**
 * Shared setup for learning-domain tests.
 *
 * Uses MONGO_URI_TEST (default mongodb://127.0.0.1:27017/navigate_test_learning);
 * the database name must contain "test" because it is dropped before each file.
 * AI is disabled (empty API keys) so every AI feature exercises its fallback.
 */
const mongoose = require('mongoose');
const request = require('supertest');

const TEST_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/navigate_test_learning';

function loadApp() {
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
  process.env.RATE_LIMIT_AUTH_MAX = '1000';
  process.env.RATE_LIMIT_GENERAL_MAX = '100000';
  process.env.RATE_LIMIT_AI_MAX = '1000';
  // dotenv never overrides variables that are already set, so these stay empty.
  process.env.GEMINI_API_KEY = '';
  process.env.HUGGINGFACE_API_KEY = '';
  return require('../../server');
}

async function connectFresh(connectDB) {
  const dbName = new URL(TEST_URI).pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error(`Refusing to drop non-test database "${dbName}"`);
  if (!(await connectDB(TEST_URI))) throw new Error(`Cannot connect to ${TEST_URI}`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
}

async function disconnect() {
  await require('../../services/attemptService').whenIdle();
  await require('../../services/learningPathService').whenIdle();
  await mongoose.disconnect();
}

let counter = 0;

/**
 * Creates a workspace with an owner, two instructors and `studentCount`
 * students, each with an access token.
 */
async function createWorkspace({ name = 'Test Academy', plan = 'pro', studentCount = 3 } = {}) {
  const Organization = require('../../models/Organization');
  const User = require('../../models/User');
  const { signAccessToken } = require('../../services/tokens');
  counter += 1;
  const org = await Organization.create({ name, slug: `${name.toLowerCase().replace(/\W+/g, '-')}-${counter}`, plan });
  const make = async (role, label) => {
    const user = await User.create({
      organization: org._id,
      name: label,
      email: `${role}.${counter}.${label.replace(/\W+/g, '').toLowerCase()}@example.com`,
      password: 'Passw0rd1',
      role
    });
    return { id: String(user._id), name: user.name, email: user.email, role, token: signAccessToken(user) };
  };
  const owner = await make('owner', 'Olivia Owner');
  const instructor = await make('instructor', 'Ivan Instructor');
  const instructor2 = await make('instructor', 'Irene Other');
  const students = [];
  for (let i = 0; i < studentCount; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    students.push(await make('student', `Student ${String.fromCharCode(65 + i)}`));
  }
  return { org, orgId: String(org._id), owner, instructor, instructor2, students };
}

const auth = (user) => ({ 'x-auth-token': user.token });

/** A question set covering every type, with keys. */
const sampleQuestions = () => ([
  { id: 'mc1', type: 'multiple-choice', text: 'Capital of France?', options: ['Berlin', 'Paris', 'Rome', 'Madrid'], correctAnswer: 'Paris', points: 2, topic: 'Geography', difficulty: 'Easy', explanation: 'Paris is the capital.' },
  { id: 'ms1', type: 'multiple-select', text: 'Pick the primes', options: ['2', '3', '4', '9'], correctAnswer: ['2', '3'], points: 2, topic: 'Math' },
  { id: 'tf1', type: 'true-false', text: 'The earth is flat.', correctAnswer: 'False', points: 1, topic: 'Geography' },
  { id: 'sa1', type: 'short-answer', text: 'Big-O of binary search?', correctAnswer: ['O(log n)', 'logarithmic'], points: 2, topic: 'Algorithms' },
  { id: 'es1', type: 'essay', text: 'Explain recursion.', points: 3, topic: 'Algorithms' }
]);

/** Creates a course taught by `instructor` with the given students enrolled. */
async function createCourse(app, instructor, students = [], body = {}) {
  const res = await request(app).post('/api/courses').set(auth(instructor))
    .send({ title: 'Course 101', code: 'C101', topics: ['Geography', 'Math', 'Algorithms'], ...body });
  if (res.status !== 201) throw new Error(`createCourse failed: ${res.status} ${JSON.stringify(res.body)}`);
  if (students.length) {
    const add = await request(app).post(`/api/courses/${res.body.id}/students`).set(auth(instructor))
      .send({ emails: students.map((s) => s.email) });
    if (add.status !== 200) throw new Error(`enroll failed: ${add.status} ${JSON.stringify(add.body)}`);
  }
  return res.body;
}

/** Creates (and by default publishes) an assessment in `courseId`. */
async function createAssessment(app, instructor, courseId, body = {}, { publish = true } = {}) {
  const res = await request(app).post('/api/assessments').set(auth(instructor))
    .send({ courseId, title: 'Quiz', questions: sampleQuestions(), ...body });
  if (res.status !== 201) throw new Error(`createAssessment failed: ${res.status} ${JSON.stringify(res.body)}`);
  if (!publish) return res.body;
  const pub = await request(app).post(`/api/assessments/${res.body.id}/publish`).set(auth(instructor));
  if (pub.status !== 200) throw new Error(`publish failed: ${pub.status} ${JSON.stringify(pub.body)}`);
  return pub.body;
}

/** Starts an attempt and submits `answers`; returns the submit response body. */
async function takeAssessment(app, student, assessmentId, answers) {
  const start = await request(app).post(`/api/assessments/${assessmentId}/attempts`).set(auth(student));
  if (start.status !== 201) throw new Error(`start failed: ${start.status} ${JSON.stringify(start.body)}`);
  const submit = await request(app).post(`/api/submissions/${start.body.submission.id}/submit`).set(auth(student))
    .send({ answers });
  if (submit.status !== 200) throw new Error(`submit failed: ${submit.status} ${JSON.stringify(submit.body)}`);
  return submit.body;
}

module.exports = {
  loadApp,
  connectFresh,
  disconnect,
  createWorkspace,
  createCourse,
  createAssessment,
  takeAssessment,
  sampleQuestions,
  auth,
  request
};
