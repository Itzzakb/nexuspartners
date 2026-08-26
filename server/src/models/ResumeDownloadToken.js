import mongoose from 'mongoose';

const resumeDownloadTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, trim: true },
    filePath: { type: String, required: true },
    filename: { type: String, required: true },
    cloudinaryUrl: { type: String, default: '' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    studentPhone: { type: String, default: '' },
    resumeLibraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecruiterResumeLibrary',
      default: null,
    },
  },
  { timestamps: true }
);

resumeDownloadTokenSchema.index({ token: 1 }, { unique: true });
resumeDownloadTokenSchema.index({ resumeLibraryId: 1 });

export default mongoose.model('ResumeDownloadToken', resumeDownloadTokenSchema);
