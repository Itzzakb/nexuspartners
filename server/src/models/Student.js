import mongoose from 'mongoose';

const STATUS = ['active', 'inactive', 'suspended'];

const studentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    phoneNormalized: { type: String, required: true, trim: true },
    role: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    /** ISO-2 country code used to auto-filter recruiter job search (e.g. US, IN). */
    jobSearchCountry: { type: String, default: '', trim: true, uppercase: true },
    linkedin: { type: String, default: '' },
    status: { type: String, enum: STATUS, default: 'active' },
    resume: { type: mongoose.Schema.Types.Mixed, default: null },
    additionalDetails: { type: [mongoose.Schema.Types.Mixed], default: [] },
    recruiterUsername: { type: String, default: '', trim: true },
    joinDate: { type: String, default: '' },
    subscriptionAmount: { type: Number, default: 0 },
    subscriptionDate: { type: Date, default: null },
    subscriptionDays: { type: Number, default: 0 },
    visa: { type: String, default: '' },
    isDemo: { type: Boolean, default: false },
    /**
     * Optional dedicated share token. Prefer omitting the field when unused.
     * Do NOT default to null — a unique index treats many nulls as duplicates.
     */
    shareToken: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

studentSchema.index({ companyId: 1, phoneNormalized: 1 }, { unique: true });
studentSchema.index({ companyId: 1, status: 1 });
studentSchema.index({ companyId: 1, recruiterUsername: 1 });
studentSchema.index({ companyId: 1, name: 1 });
// Unique only when a real token string is present (missing/empty allowed for many students).
studentSchema.index(
  { shareToken: 1 },
  {
    unique: true,
    partialFilterExpression: {
      shareToken: { $exists: true, $type: 'string', $gt: '' },
    },
  }
);

export default mongoose.model('Student', studentSchema);
export { STATUS as STUDENT_STATUSES };
