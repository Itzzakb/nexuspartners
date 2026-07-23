import mongoose from 'mongoose';

const jobSearchProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    isActive: { type: Boolean, default: true },
    filters: {
      job_title_or: { type: [String], default: [] },
      job_country_code_or: { type: [String], default: [] },
      url_domain_or: { type: [String], default: [] },
      /** TheirStack url_domain_not — scrape all sources except these domains. */
      url_domain_not: { type: [String], default: [] },
      company_domain_or: { type: [String], default: [] },
      job_location_ids: { type: [Number], default: [] },
      posted_filter_mode: { type: String, enum: ['hours', 'days', 'range'], default: 'days' },
      posted_at_max_age_hours: { type: Number, default: 24 },
      posted_at_max_age_days: { type: Number, default: 7 },
      posted_at_gte: { type: String, default: '' },
      posted_at_lte: { type: String, default: '' },
      remote: { type: Boolean, default: null },
      limit: { type: Number, default: 25 },
    },
    scheduleTime: { type: String, default: '09:00' },
    scheduleDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    timezone: { type: String, default: 'Asia/Kolkata' },
    lastSyncedAt: { type: Date, default: null },
    lastJobCount: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

jobSearchProfileSchema.index({ companyId: 1, isActive: 1 });

export default mongoose.model('JobSearchProfile', jobSearchProfileSchema);
