import mongoose from 'mongoose';

const resumeTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    description: { type: String, default: '' },
    templateContent: { type: String, default: '' },
    sections: { type: [String], default: ['summary', 'experience', 'education', 'skills'] },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

resumeTemplateSchema.index({ companyId: 1 });

export default mongoose.model('ResumeTemplate', resumeTemplateSchema);
