import mongoose from 'mongoose';

const scrapedJobSchema = new mongoose.Schema(
  {
    theirstackJobId: { type: Number, default: null },
    source: { type: String, enum: ['theirstack', 'manual'], default: 'theirstack' },
    searchProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobSearchProfile', default: null },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    jobTitle: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    companyName: { type: String, default: '' },
    companyDomain: { type: String, default: '' },
    location: { type: String, default: '' },
    countryCode: { type: String, default: '' },
    remote: { type: Boolean, default: false },
    hybrid: { type: Boolean, default: false },
    seniority: { type: String, default: '' },
    /** Required experience band in years (nullable = unknown / not specified). */
    minExperienceYears: { type: Number, default: null },
    maxExperienceYears: { type: Number, default: null },
    technologySlugs: { type: [String], default: [] },
    salaryMinUsd: { type: Number, default: null },
    salaryMaxUsd: { type: Number, default: null },
    datePosted: { type: Date, default: null },
    discoveredAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    isClosed: { type: Boolean, default: false },
    applyUrl: { type: String, default: '' },
    finalUrl: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    urlDomain: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'applied', 'closed', 'archived'],
      default: 'open',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastSyncedAt: { type: Date, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

scrapedJobSchema.index({ companyId: 1, datePosted: -1 });
scrapedJobSchema.index({ companyId: 1, minExperienceYears: 1, maxExperienceYears: 1 });
scrapedJobSchema.index(
  { theirstackJobId: 1, companyId: 1 },
  { unique: true, partialFilterExpression: { theirstackJobId: { $type: 'number' } } }
);

export default mongoose.model('ScrapedJob', scrapedJobSchema);
