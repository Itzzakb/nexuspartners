import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
