import mongoose from 'mongoose';
import { APPLICATION_STATUSES } from '../constants/recruiterApplications.js';

const studentJobActionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    recruiterUsername: { type: String, required: true, trim: true },
    studentPhone: { type: String, required: true, trim: true },
    scrapedJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', required: true },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'saved',
    },
    appliedAt: { type: Date, default: null },
    droppedAt: { type: Date, default: null },
    statusUpdatedAt: { type: Date, default: null },
    resumeFixedAt: { type: Date, default: null },
    atsResumeUrl: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

studentJobActionSchema.index(
  { companyId: 1, studentPhone: 1, scrapedJobId: 1 },
  { unique: true }
);
studentJobActionSchema.index({ companyId: 1, recruiterUsername: 1, status: 1, appliedAt: -1 });
studentJobActionSchema.index({ companyId: 1, studentPhone: 1, status: 1 });

export default mongoose.model('StudentJobAction', studentJobActionSchema);
