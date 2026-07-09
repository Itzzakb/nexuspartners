import mongoose from 'mongoose';

const placementDocSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['offer_letter', 'interview_screenshot', 'other'], default: 'other' },
    label: { type: String, default: '' },
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
  },
  { _id: true }
);

const jobPlacementSchema = new mongoose.Schema(
  {
    candidateName: { type: String, required: true, trim: true },
    email: { type: String, default: '' },
    mobile: { type: String, default: '' },
    companyName: { type: String, default: '' },
    placementDate: { type: Date, default: null },
    durationMonths: { type: Number, default: 0 },
    documents: [placementDocSchema],
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
    deleteReason: { type: String, default: '' },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobPlacementSchema.index({ companyId: 1, isDeleted: 1 });

export default mongoose.model('JobPlacement', jobPlacementSchema);
