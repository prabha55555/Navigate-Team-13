const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');

const { Schema } = mongoose;

const MAX_INTEGRITY_EVENTS = 200;

const QuestionResultSchema = new Schema({
  questionId: { type: String, required: true },
  isCorrect: { type: Boolean, default: false },
  pointsEarned: { type: Number, default: 0 },
  maxPoints: { type: Number, default: 0 },
  feedback: { type: String, default: '' },
  // True while a written answer only has the automatic (length-based) score.
  needsReview: { type: Boolean, default: false }
}, { _id: false });

const IntegrityEventSchema = new Schema({
  type: { type: String, required: true, maxlength: 60 },
  at: { type: Date, default: Date.now },
  detail: { type: String, maxlength: 500 }
}, { _id: false });

const SubmissionSchema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  attempt: { type: Number, min: 1, required: true },
  // Copied from the assessment so practice attempts can be excluded without a lookup.
  isPractice: { type: Boolean, default: false },
  status: { type: String, enum: ['in-progress', 'submitted', 'terminated'], default: 'in-progress' },
  startedAt: { type: Date, default: Date.now },
  deadlineAt: { type: Date, default: null },
  submittedAt: Date,
  timeSpent: { type: Number, default: 0 }, // seconds
  answers: { type: Schema.Types.Mixed, default: {} },
  questionOrder: [String],
  // { [questionId]: [original option indexes in display order] } when options are shuffled.
  optionOrder: { type: Schema.Types.Mixed, default: undefined },
  questionResults: { type: [QuestionResultSchema], default: [] },
  score: Number,
  maxScore: Number,
  percentage: Number,
  isPassed: Boolean,
  needsReview: { type: Boolean, default: false },
  integrity: {
    violationCount: { type: Number, default: 0 },
    terminated: { type: Boolean, default: false },
    events: { type: [IntegrityEventSchema], default: [] }
  },
  plagiarism: { type: Schema.Types.Mixed, default: undefined },
  aiFeedback: { type: Schema.Types.Mixed, default: undefined },
  override: {
    score: Number,
    comment: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    at: Date
  }
}, { timestamps: true, minimize: false });

SubmissionSchema.index({ assessment: 1, student: 1, attempt: 1 }, { unique: true });
SubmissionSchema.index({ organization: 1, course: 1, status: 1, submittedAt: -1 });
SubmissionSchema.index({ organization: 1, student: 1, submittedAt: -1 });
SubmissionSchema.index({ organization: 1, submittedAt: -1 });

SubmissionSchema.plugin(toJSONPlugin);

SubmissionSchema.statics.MAX_INTEGRITY_EVENTS = MAX_INTEGRITY_EVENTS;

module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
