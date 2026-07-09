import PermissionTemplate, { templatePermissionsToObject } from '../models/PermissionTemplate.js';
import User from '../models/User.js';
import { MODULE_KEYS } from '../constants/modules.js';
import { getCompanyFilter } from '../services/billing.service.js';

function templateToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    name: o.name,
    companyId: o.companyId?.toString?.() ?? o.companyId,
    modulePermissions: templatePermissionsToObject(o),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function listTemplates(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const items = await PermissionTemplate.find(filter).sort({ name: 1 });
    return res.json({ templates: items.map(templateToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list templates' });
  }
}

export async function createTemplate(req, res) {
  try {
    const { name, modulePermissions, companyId } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name is required' });

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const item = await PermissionTemplate.create({
      name,
      companyId: targetCompanyId,
      modulePermissions: modulePermissions || {},
      createdBy: req.user._id,
    });

    return res.status(201).json({ template: templateToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create template' });
  }
}

export async function updateTemplate(req, res) {
  try {
    const item = await PermissionTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Template not found' });

    if (req.body.name) item.name = req.body.name;
    if (req.body.modulePermissions) item.modulePermissions = req.body.modulePermissions;

    await item.save();
    return res.json({ template: templateToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update template' });
  }
}

export async function deleteTemplate(req, res) {
  try {
    const item = await PermissionTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Template not found' });
    await item.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete template' });
  }
}

export async function updateUserPermissions(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.isCompanyAdmin || user.isPlatformAdmin) {
      return res.status(400).json({ error: 'Cannot modify permissions for admin users' });
    }

    const canManage =
      req.user.isPlatformAdmin ||
      (req.user.isCompanyAdmin && user.companyId.toString() === req.user.companyId._id.toString());

    if (!canManage) return res.status(403).json({ error: 'Access denied' });

    const { modulePermissions, permissionTemplateId } = req.body;

    if (permissionTemplateId) {
      const template = await PermissionTemplate.findById(permissionTemplateId);
      if (!template) return res.status(400).json({ error: 'Template not found' });
      user.permissionTemplateId = template._id;
      user.modulePermissions = template.modulePermissions;
    } else if (modulePermissions) {
      user.modulePermissions = modulePermissions;
      user.permissionTemplateId = null;
    }

    await user.save();
    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update permissions' });
  }
}

export async function getModuleKeys(_req, res) {
  return res.json({ modules: MODULE_KEYS });
}
