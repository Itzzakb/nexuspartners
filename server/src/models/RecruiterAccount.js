import mongoose from 'mongoose';

const recruiterAccountSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recruiterAccountSchema.index({ username: 1, companyId: 1 }, { unique: true });

recruiterAccountSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    username: this.username,
    name: this.name,
    email: this.email,
    phone: this.phone,
    companyId: this.companyId?.toString?.() ?? this.companyId,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
  };
};

export default mongoose.model('RecruiterAccount', recruiterAccountSchema);
