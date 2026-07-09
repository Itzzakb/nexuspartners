import mongoose from 'mongoose';
import { MODULE_KEYS } from '../constants/modules.js';

const permissionTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    modulePermissions: {
      type: Map,
      of: Boolean,
      default: {},
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

permissionTemplateSchema.index({ companyId: 1 });

export function templatePermissionsToObject(doc) {
  const perms = doc.modulePermissions || new Map();
  const obj = {};
  MODULE_KEYS.forEach((k) => {
    obj[k] = perms.get?.(k) ?? perms[k] ?? false;
  });
  return obj;
}

export default mongoose.model('PermissionTemplate', permissionTemplateSchema);
