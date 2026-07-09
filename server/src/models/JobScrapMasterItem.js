import mongoose from 'mongoose';

const jobScrapMasterItemSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    category: {
      type: String,
      enum: ['job_title', 'country_code', 'domain'],
      required: true,
    },
    value: { type: String, required: true, trim: true },
    label: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

jobScrapMasterItemSchema.index({ companyId: 1, category: 1, value: 1 }, { unique: true });
jobScrapMasterItemSchema.index({ companyId: 1, category: 1, isActive: 1, sortOrder: 1 });

export default mongoose.model('JobScrapMasterItem', jobScrapMasterItemSchema);
