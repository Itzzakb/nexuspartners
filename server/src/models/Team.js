import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    mobile: { type: String, default: '' },
  },
  { _id: true }
);

const teamSchema = new mongoose.Schema(
  {
    teamName: { type: String, required: true, trim: true },
    teamLeadName: { type: String, required: true },
    teamLeadPhone: { type: String, default: '' },
    teamLeadEmail: { type: String, default: '' },
    teamLeadUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    members: [teamMemberSchema],
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

teamSchema.index({ companyId: 1 });

export default mongoose.model('Team', teamSchema);
