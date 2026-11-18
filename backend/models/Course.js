const crypto = require('crypto');
const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');

const { Schema } = mongoose;

// Join codes avoid look-alike characters (0/O, 1/I) so they can be read aloud or off a slide.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
const JOIN_CODE_ATTEMPTS = 10;

function randomJoinCode() {
  const bytes = crypto.randomBytes(JOIN_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  return code;
}

const OutcomeSchema = new Schema({
  // Referenced from curriculumMap.links, so it must stay stable across edits.
  id: { type: String, default: () => `o-${crypto.randomBytes(4).toString('hex')}` },
  code: { type: String, trim: true, maxlength: 40 },
  description: { type: String, trim: true, maxlength: 1000 },
  bloomLevel: { type: String, trim: true, maxlength: 40 }
}, { _id: false });

const CurriculumLinkSchema = new Schema({
  outcomeId: { type: String, required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true }
}, { _id: false });

const CourseSchema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  code: { type: String, trim: true, maxlength: 40, default: '' },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  term: { type: String, trim: true, maxlength: 80, default: '' },
  color: { type: String, trim: true, maxlength: 20, default: '#4f46e5' },
  instructors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  joinCode: { type: String, uppercase: true },
  joinCodeEnabled: { type: Boolean, default: true },
  archived: { type: Boolean, default: false },
  topics: [{ type: String, trim: true, maxlength: 120 }],
  outcomes: [OutcomeSchema],
  curriculumMap: {
    links: { type: [CurriculumLinkSchema], default: [] }
  }
}, { timestamps: true });

CourseSchema.index({ joinCode: 1 }, { unique: true, sparse: true });
CourseSchema.index({ organization: 1, archived: 1, createdAt: -1 });
CourseSchema.index({ organization: 1, instructors: 1 });

/** A join code that no other course currently uses. */
CourseSchema.statics.generateJoinCode = async function generateJoinCode() {
  for (let i = 0; i < JOIN_CODE_ATTEMPTS; i += 1) {
    const code = randomJoinCode();
    // eslint-disable-next-line no-await-in-loop
    if (!(await this.exists({ joinCode: code }))) return code;
  }
  throw new Error('Could not generate a unique join code');
};

CourseSchema.pre('validate', async function assignJoinCode() {
  if (!this.joinCode) this.joinCode = await this.constructor.generateJoinCode();
});

CourseSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.Course || mongoose.model('Course', CourseSchema);
