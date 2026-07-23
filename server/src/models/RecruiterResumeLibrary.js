import mongoose from 'mongoose';

const recruiterResumeLibrarySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    recruiterUsername: { type: String, required: true, trim: true },
    studentPhone: { type: String, required: true, trim: true },
    studentName: { type: String, default: '' },
    scrapedJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', default: null },
    jobTitle: { type: String, default: '' },
    companyName: { type: String, default: '' },
    resumeData: { type: mongoose.Schema.Types.Mixed, default: null },
    downloadUrl: { type: String, default: '' },
    atsScore: { type: Number, default: null },
    atsSummary: { type: String, default: '' },
    atsImprovements: { type: [String], default: [] },
    atsMeetsTarget: { type: Boolean, default: false },
    atsScoredAt: { type: Date, default: null },
    source: {
      type: String,
      enum: ['fix_resume', 'ats_download', 'manual'],
      default: 'fix_resume',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

recruiterResumeLibrarySchema.index({ companyId: 1, recruiterUsername: 1, createdAt: -1 });
recruiterResumeLibrarySchema.index({ companyId: 1, studentPhone: 1, createdAt: -1 });
recruiterResumeLibrarySchema.index({
  companyId: 1,
  scrapedJobId: 1,
  studentPhone: 1,
  recruiterUsername: 1,
});

export default mongoose.model('RecruiterResumeLibrary', recruiterResumeLibrarySchema);
