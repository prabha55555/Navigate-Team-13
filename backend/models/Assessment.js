const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');
const { normalizeQuestionType } = require('../services/gradingService');
const { QUESTION_TYPES, DIFFICULTIES, QUESTION_ID_PATTERN } = require('../services/questions');
const { canonicalTopic } = require('../services/topics');
const Course = require('./Course');

const { Schema } = mongoose;

const QuestionSchema = new Schema({
  id: { type: String, required: true, match: QUESTION_ID_PATTERN },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  text: { type: String, required: true, trim: true, maxlength: 10000 },
  options: { type: [String], default: [] },
  // Option text (multiple-choice), array of option texts (multiple-select),
  // 'True'/'False' (true-false), model answer or keywords (short-answer/essay).
  correctAnswer: { type: Schema.Types.Mixed, default: null },
  points: { type: Number, min: 0, max: 1000, default: 1 },
  topic: { type: String, trim: true, maxlength: 120, default: '' },
  difficulty: { type: String, enum: DIFFICULTIES, default: 'Medium' },
  bloomLevel: { type: String, trim: true, maxlength: 40, default: '' },
  explanation: { type: String, trim: true, maxlength: 5000, default: '' }
}, { _id: false });

const AssessmentSchema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  instructions: { type: String, trim: true, maxlength: 5000, default: '' },
  status: { type: String, enum: ['draft', 'published', 'closed', 'archived'], default: 'draft' },
  publishedAt: Date,
  availableFrom: Date,
  dueDate: Date,
  timeLimit: { type: Number, min: 0, max: 24 * 60, default: 0 }, // minutes, 0 = no limit
  maxAttempts: { type: Number, min: 1, max: 100, default: 1 },
  passingScore: { type: Number, min: 0, max: 100, default: 50 },
  shuffleQuestions: { type: Boolean, default: false },
  shuffleOptions: { type: Boolean, default: false },
  resultsPolicy: { type: String, enum: ['immediate', 'after-due', 'manual'], default: 'immediate' },
  resultsReleased: { type: Boolean, default: false },
  showCorrectAnswers: { type: Boolean, default: false },
  proctoring: {
    enabled: { type: Boolean, default: false },
    fullscreen: { type: Boolean, default: false },
    webcam: { type: Boolean, default: false },
    blockShortcuts: { type: Boolean, default: false },
    maxViolations: { type: Number, min: 1, max: 100, default: 5 }
  },
  questions: { type: [QuestionSchema], default: [] },
  totalPoints: { type: Number, default: 0 },
  source: { type: String, enum: ['manual', 'ai-syllabus', 'ai-quick', 'bank', 'practice'], default: 'manual' },
  isPractice: { type: Boolean, default: false },
  practiceFor: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

AssessmentSchema.index({ organization: 1, course: 1, status: 1, isPractice: 1 });
AssessmentSchema.index({ organization: 1, status: 1, dueDate: 1 });
AssessmentSchema.index({ organization: 1, practiceFor: 1 });

/** Canonical true/false key ('True'/'False') from booleans or any casing; other values unchanged. */
function toTrueFalse(value) {
  const v = String(value).trim().toLowerCase();
  if (v === 'true' || v === 't') return 'True';
  if (v === 'false' || v === 'f') return 'False';
  return value;
}

AssessmentSchema.pre('validate', function normalizeQuestions() {
  const seen = new Set();
  (this.questions || []).forEach((q, index) => {
    q.type = normalizeQuestionType(q.type);
    if (!q.id) {
      let candidate = `q${index + 1}`;
      while (seen.has(candidate)) candidate = `${candidate}x`;
      q.id = candidate;
    }
    if (seen.has(q.id)) this.invalidate(`questions.${index}.id`, `Duplicate question id "${q.id}"`);
    seen.add(q.id);
    if (q.type === 'true-false') {
      q.options = ['True', 'False'];
      if (q.correctAnswer !== null && q.correctAnswer !== undefined) q.correctAnswer = toTrueFalse(q.correctAnswer);
    }
  });
  this.totalPoints = (this.questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
});

// Question topics are stored as the course's canonical topic ("Queue Fundamentals" → "queues").
AssessmentSchema.pre('validate', async function canonicalTopics() {
  if (!this.course || !(this.isNew || this.isModified('questions') || this.isModified('course'))) return;
  const course = await Course.findById(this.course).select('topics').lean();
  if (!course) return;
  (this.questions || []).forEach((q) => { q.topic = canonicalTopic(q.topic, course.topics); });
});

AssessmentSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.Assessment || mongoose.model('Assessment', AssessmentSchema);
