import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    title: { type: String, default: '' },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: '' },
    isCrossCompany: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
