import ResumeTemplate from '../models/ResumeTemplate.js';
import Company from '../models/Company.js';
import { getCompanyFilter } from '../services/billing.service.js';

function templateToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    name: o.name,
    description: o.description,
    templateContent: o.templateContent,
    sections: o.sections,
    isDefault: o.isDefault,
    companyId: o.companyId?.toString?.() ?? o.companyId,
    companyLabel: o.companyId?.name ?? '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function listTemplates(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const items = await ResumeTemplate.find(filter).populate('companyId', 'name').sort({ name: 1 });
    return res.json({ templates: items.map(templateToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list templates' });
  }
}

export async function createTemplate(req, res) {
  try {
    const { name, description, templateContent, sections, isDefault, companyId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    if (isDefault) {
      await ResumeTemplate.updateMany({ companyId: company._id }, { isDefault: false });
    }

    const item = await ResumeTemplate.create({
      name,
      description: description || '',
      templateContent: templateContent || '',
      sections: Array.isArray(sections) && sections.length
        ? sections
        : ['summary', 'experience', 'education', 'skills', 'certifications'],
      isDefault: !!isDefault,
      companyId: company._id,
      createdBy: req.user._id,
    });

    const populated = await ResumeTemplate.findById(item._id).populate('companyId', 'name');
    return res.status(201).json({ template: templateToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create template' });
  }
}

export async function updateTemplate(req, res) {
  try {
    const item = await ResumeTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Template not found' });

    const fields = ['name', 'description', 'templateContent', 'sections', 'isDefault'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });

    if (req.body.isDefault) {
      await ResumeTemplate.updateMany({ companyId: item.companyId, _id: { $ne: item._id } }, { isDefault: false });
    }

    await item.save();
    const populated = await ResumeTemplate.findById(item._id).populate('companyId', 'name');
    return res.json({ template: templateToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update template' });
  }
}

export async function deleteTemplate(req, res) {
  try {
    const item = await ResumeTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Template not found' });
    await item.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete template' });
  }
}
