import mongoose from 'mongoose';

const studentNoteSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    studentPhone: { type: String, required: true },
    notes: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

studentNoteSchema.index({ companyId: 1, studentPhone: 1 }, { unique: true });

export default mongoose.model('StudentNote', studentNoteSchema);
