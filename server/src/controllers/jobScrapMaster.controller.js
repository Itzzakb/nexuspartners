import JobScrapMasterItem from '../models/JobScrapMasterItem.js';
import Company from '../models/Company.js';
import { getCompanyFilter } from '../services/billing.service.js';
import { seedJobScrapMasterForCompany } from '../utils/jobScrapMasterSeed.js';
import { listActiveJobTitles } from '../services/jobScrapMaster.service.js';

export const MASTER_CATEGORIES = ['job_title', 'country_code', 'domain', 'city', 'company'];
/** Categories admins can create/edit via the Job Scrap Master UI. */
export const ADMIN_EDITABLE_CATEGORIES = ['job_title', 'domain'];

export { listActiveJobTitles };

export function masterItemToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    companyId: o.companyId?.toString?.() ?? o.companyId,
    category: o.category,
    value: o.value,
    label: o.label || o.value,
    meta: o.meta || {},
    isActive: o.isActive !== false,
    sortOrder: o.sortOrder ?? 0,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function resolveCompanyId(user, queryCompanyId) {
  const filter = getCompanyFilter(user, queryCompanyId);
  let companyId = filter.companyId;
  if (!companyId && user?.companyId) {
    companyId = user.companyId._id || user.companyId;
  }
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
  const company = await Company.findById(companyId);
  if (!company) {
    const err = new Error('Company not found');
    err.status = 404;
    throw err;
  }
  return company._id;
}

export async function listMasterItems(req, res) {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.companyId);
    try {
      await seedJobScrapMasterForCompany(companyId, req.user?._id || null);
    } catch (seedErr) {
      console.warn('[JobScrapMaster] seed on list failed:', seedErr.message);
    }

    const filter = { companyId };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.activeOnly === 'true') filter.isActive = true;

    const items = await JobScrapMasterItem.find(filter).sort({
      category: 1,
      sortOrder: 1,
      label: 1,
      value: 1,
    });
    return res.json({
      items: items.map(masterItemToJSON),
      categories: ADMIN_EDITABLE_CATEGORIES,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to list master data' });
  }
}

export async function createMasterItem(req, res) {
  try {
    const companyId = await resolveCompanyId(
      req.user,
      req.body.companyId || req.query.companyId
    );
    const category = String(req.body.category || '').trim();
    const value = String(req.body.value || '').trim();
    const label = String(req.body.label || value || '').trim();
    if (!ADMIN_EDITABLE_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Only job titles and domains can be added here (got: ${category || 'empty'})`,
      });
    }
    if (!value) return res.status(400).json({ error: 'value is required' });

    const existing = await JobScrapMasterItem.findOne({ companyId, category, value });
    if (existing) {
      return res.status(409).json({ error: 'This value already exists for the selected category' });
    }

    // Auto-append at end — no sort order input for operational admins.
    const last = await JobScrapMasterItem.findOne({ companyId, category })
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .lean();
    const sortOrder = (last?.sortOrder ?? 0) + 1;

    const item = await JobScrapMasterItem.create({
      companyId,
      category,
      value,
      label: label || value,
      meta: req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : {},
      isActive: req.body.isActive !== false,
      sortOrder,
      createdBy: req.user?._id || null,
    });

    return res.status(201).json({ item: masterItemToJSON(item) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Duplicate master item' });
    }
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to create master item' });
  }
}

export async function updateMasterItem(req, res) {
  try {
    const item = await JobScrapMasterItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Master item not found' });

    if (!req.user.isPlatformAdmin) {
      const userCompanyId = (req.user.companyId._id || req.user.companyId).toString();
      if (item.companyId.toString() !== userCompanyId) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }

    if (!ADMIN_EDITABLE_CATEGORIES.includes(item.category)) {
      return res.status(400).json({ error: 'Only job titles and domains can be edited here' });
    }
    if (req.body.category !== undefined) {
      const category = String(req.body.category || '').trim();
      if (!ADMIN_EDITABLE_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Category must be job_title or domain' });
      }
      item.category = category;
    }
    if (req.body.value !== undefined) {
      const value = String(req.body.value || '').trim();
      if (!value) return res.status(400).json({ error: 'value is required' });
      item.value = value;
    }
    if (req.body.label !== undefined) item.label = String(req.body.label || item.value).trim();
    if (req.body.isActive !== undefined) item.isActive = !!req.body.isActive;
    if (req.body.meta !== undefined && typeof req.body.meta === 'object') {
      item.meta = req.body.meta;
    }

    await item.save();
    return res.json({ item: masterItemToJSON(item) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Duplicate master item' });
    }
    return res.status(500).json({ error: err.message || 'Failed to update master item' });
  }
}

export async function deleteMasterItem(req, res) {
  try {
    const item = await JobScrapMasterItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Master item not found' });

    if (!req.user.isPlatformAdmin) {
      const userCompanyId = (req.user.companyId._id || req.user.companyId).toString();
      if (item.companyId.toString() !== userCompanyId) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }

    if (!ADMIN_EDITABLE_CATEGORIES.includes(item.category)) {
      return res.status(400).json({ error: 'Only job titles and domains can be deleted here' });
    }

    await item.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete master item' });
  }
}
