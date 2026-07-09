import mongoose from 'mongoose';

const jobScrapRunSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    searchProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobSearchProfile', default: null },
    trigger: { type: String, enum: ['cron', 'manual'], default: 'manual' },
    status: { type: String, enum: ['success', 'failed', 'partial'], default: 'success' },
    jobsFetched: { type: Number, default: 0 },
    jobsUpserted: { type: Number, default: 0 },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobScrapRunSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model('JobScrapRun', jobScrapRunSchema);
