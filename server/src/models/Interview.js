import mongoose from 'mongoose';
import crypto from 'crypto';

const INTERVIEW_STAGES = ['interview_reported', 'ready_for_interview', 'interview_completed'];

const interviewSchema = new mongoose.Schema(
  {
    interviewNumber: { type: String, required: true, unique: true },
    candidateName: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    studentPhone: { type: String, default: '' },
    position: { type: String, default: '' },
    companyName: { type: String, default: '' },
    interviewDateTime: { type: Date, default: null },
    timezone: { type: String, default: 'America/New_York' },
    jobDescription: { type: String, default: '' },
    screenshotUrl: { type: String, default: '' },
    resumeFileUrl: { type: String, default: '' },
    currentStage: {
      type: String,
      enum: INTERVIEW_STAGES,
      default: 'interview_reported',
    },
    isCancelled: { type: Boolean, default: false },
    isSelfInstruction: { type: Boolean, default: false },
    movedForward: { type: Boolean, default: null },
    movedForwardReason: { type: String, default: '' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shareToken: { type: String, default: () => crypto.randomUUID() },
    isDeleted: { type: Boolean, default: false },
    deletedReason: { type: String, default: '' },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

interviewSchema.index({ companyId: 1, currentStage: 1, isDeleted: 1 });

export default mongoose.model('Interview', interviewSchema);
export { INTERVIEW_STAGES };
