import mongoose from 'mongoose';
import crypto from 'crypto';

const fileSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
    type: { type: String, enum: ['file', 'link'], default: 'file' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: String,
    type: { type: String, enum: ['work', 'onboarding'], default: 'work' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    ticketType: { type: String, enum: ['new_resume', 'existing_resume'], required: true },
    candidateName: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    dueDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    chatLink: { type: String, default: '' },
    studentPhone: { type: String, default: '' },
    studentProfileLink: { type: String, default: '' },
    currentStage: {
      type: String,
      enum: [
        'ticket_created',
        'group_created',
        'waiting_for_approval',
        'sent_to_onboarding',
        'onboarded_successfully',
      ],
      default: 'ticket_created',
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByLabel: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resumeFiles: [fileSchema],
    workNotes: [noteSchema],
    onboardingNotes: [noteSchema],
    onboardingSuccessful: { type: Boolean, default: null },
    sendBackReason: { type: String, default: '' },
    resumeFormToken: { type: String, default: () => crypto.randomUUID() },
    resumeFormStatus: {
      type: String,
      enum: ['unfilled', 'partial', 'completed'],
      default: 'unfilled',
    },
    resumeFormData: { type: mongoose.Schema.Types.Mixed, default: null },
    resumeFormEditEnabled: { type: Boolean, default: false },
    resumeFormViewToken: { type: String, default: () => crypto.randomUUID() },
    isDeleted: { type: Boolean, default: false },
    deleteReason: { type: String, default: '' },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
    externalSource: { type: String, default: '' },
  },
  { timestamps: true }
);

ticketSchema.index({ companyId: 1, currentStage: 1, isDeleted: 1 });
ticketSchema.index({ assignedTo: 1, isDeleted: 1 });
ticketSchema.index({ ticketType: 1, currentStage: 1 });

export default mongoose.model('Ticket', ticketSchema);
