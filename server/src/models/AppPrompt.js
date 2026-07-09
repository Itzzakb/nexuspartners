import mongoose from 'mongoose';

const appPromptSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    content: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('AppPrompt', appPromptSchema);
