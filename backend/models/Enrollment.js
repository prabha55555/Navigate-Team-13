const mongoose = require('mongoose');
const { toJSONPlugin } = require('../utils/serialize');

const { Schema } = mongoose;

/** A student's membership in a course. Removing a student keeps the row (status 'removed') for history. */
const EnrollmentSchema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'removed'], default: 'active' },
  enrolledAt: { type: Date, default: Date.now }
}, { timestamps: false });

EnrollmentSchema.index({ course: 1, student: 1 }, { unique: true });
EnrollmentSchema.index({ organization: 1, student: 1, status: 1 });
EnrollmentSchema.index({ organization: 1, course: 1, status: 1 });

EnrollmentSchema.plugin(toJSONPlugin);

module.exports = mongoose.models.Enrollment || mongoose.model('Enrollment', EnrollmentSchema);
