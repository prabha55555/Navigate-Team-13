const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');
const { normalizeQuestionType } = require('../services/gradingService');
const { QUESTION_TYPES, DIFFICULTIES } = require('../services/questions');
const { canonicalTopic } = require('../services/topics');
const Course = require('./Course');

const { Schema } = mongoose;

/** A reusable question, shared across the workspace (optionally tied to one course). */
const QuestionBankItemSchema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  text: { type: String, required: true, trim: true, maxlength: 10000 },
  options: { type: [String], default: [] },
  correctAnswer: { type: Schema.Types.Mixed, default: null },
  points: { type: Number, min: 0, max: 1000, default: 1 },
  topic: { type: String, trim: true, maxlength: 120, default: '' },
  difficulty: { type: String, enum: DIFFICULTIES, default: 'Medium' },
  bloomLevel: { type: String, trim: true, maxlength: 40, default: '' },
  explanation: { type: String, trim: true, maxlength: 5000, default: '' },
  tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }]
}, { timestamps: true });

QuestionBankItemSchema.index({ organization: 1, course: 1, topic: 1, createdAt: -1 });
QuestionBankItemSchema.index({ organization: 1, type: 1, difficulty: 1 });

QuestionBankItemSchema.pre('validate', async function normalize() {
  this.type = normalizeQuestionType(this.type);
  if (this.type === 'true-false') this.options = ['True', 'False'];
  // Course-specific items use the course's canonical topic names.
  if (this.course && (this.isNew || this.isModified('topic') || this.isModified('course'))) {
    const course = await Course.findById(this.course).select('topics').lean();
    if (course) this.topic = canonicalTopic(this.topic, course.topics);
  }
});

QuestionBankItemSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.QuestionBankItem || mongoose.model('QuestionBankItem', QuestionBankItemSchema);
