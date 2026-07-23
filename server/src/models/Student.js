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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

studentSchema.index({ companyId: 1, phoneNormalized: 1 }, { unique: true });
studentSchema.index({ companyId: 1, status: 1 });
studentSchema.index({ companyId: 1, recruiterUsername: 1 });
studentSchema.index({ companyId: 1, name: 1 });

export default mongoose.model('Student', studentSchema);
export { STATUS as STUDENT_STATUSES };
