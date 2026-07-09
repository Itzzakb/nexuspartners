import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    role: {
      type: String,
      enum: ['admin', 'mentor', 'resume', 'onboarding'],
      default: 'mentor',
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    isActive: { type: Boolean, default: true },
    isCompanyAdmin: { type: Boolean, default: false },
    isPlatformAdmin: { type: Boolean, default: false },
    modulePermissions: {
      type: Map,
      of: Boolean,
      default: {},
    },
    permissionTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PermissionTemplate',
      default: null,
    },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    phone: this.phone,
    role: this.role,
    companyId: this.companyId?.toString?.() ?? this.companyId,
    isActive: this.isActive,
    isCompanyAdmin: this.isCompanyAdmin,
    isPlatformAdmin: this.isPlatformAdmin,
    modulePermissions: Object.fromEntries(this.modulePermissions || []),
    permissionTemplateId: this.permissionTemplateId?.toString?.() ?? this.permissionTemplateId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('User', userSchema);
