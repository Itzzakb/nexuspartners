import JobPlacement from '../models/JobPlacement.js';
import Company from '../models/Company.js';
import {
  getCompanyFilter,
  canAccessCompany,
  placementToJSON,
} from '../utils/staffPortalHelpers.js';

export async function listPlacements(req, res) {
  try {
    const showDeleted = req.query.deleted === 'true';
    const filter = {
      ...getCompanyFilter(req.user, req.query.companyId),
      isDeleted: showDeleted,
    };

    const items = await JobPlacement.find(filter)
      .populate('companyId', 'name')
      .sort({ placementDate: -1, createdAt: -1 });

    return res.json({ placements: items.map(placementToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list placements' });
  }
}

export async function getPlacement(req, res) {
  try {
    const item = await JobPlacement.findById(req.params.id).populate('companyId', 'name');
    if (!item) return res.status(404).json({ error: 'Placement not found' });
    if (!canAccessCompany(req.user, item.companyId._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json({ placement: placementToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get placement' });
  }
}

export async function createPlacement(req, res) {
  try {
    const {
      candidateName,
      email,
      mobile,
      companyName,
      placementDate,
      durationMonths,
      documents,
      companyId,
    } = req.body;

    if (!candidateName) return res.status(400).json({ error: 'Candidate name is required' });

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const item = await JobPlacement.create({
      candidateName,
      email: email || '',
      mobile: mobile || '',
      companyName: companyName || '',
      placementDate: placementDate ? new Date(placementDate) : null,
      durationMonths: durationMonths || 0,
      documents: documents || [],
      companyId: company._id,
      createdBy: req.user._id,
    });

    const populated = await JobPlacement.findById(item._id).populate('companyId', 'name');
    return res.status(201).json({ placement: placementToJSON(populated) });
  } catch (err) {
    console.error('Create placement error:', err);
    return res.status(500).json({ error: 'Failed to create placement' });
  }
}

export async function updatePlacement(req, res) {
  try {
    const item = await JobPlacement.findById(req.params.id);
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Placement not found' });
    if (!canAccessCompany(req.user, item.companyId)) return res.status(403).json({ error: 'Access denied' });

    const fields = ['candidateName', 'email', 'mobile', 'companyName', 'durationMonths', 'documents'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });
    if (req.body.placementDate !== undefined) {
      item.placementDate = req.body.placementDate ? new Date(req.body.placementDate) : null;
    }

    await item.save();
    const populated = await JobPlacement.findById(item._id).populate('companyId', 'name');
    return res.json({ placement: placementToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update placement' });
  }
}

export async function deletePlacement(req, res) {
  try {
    const { password, reason } = req.body;
    const expected = process.env.PLACEMENT_DELETE_PASSWORD || 'Saibaba@2026';
    if (password !== expected) {
      return res.status(403).json({ error: 'Invalid password' });
    }

    const item = await JobPlacement.findById(req.params.id);
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Placement not found' });
    if (!canAccessCompany(req.user, item.companyId)) return res.status(403).json({ error: 'Access denied' });

    item.isDeleted = true;
    item.deleteReason = reason || '';
    item.deletedBy = req.user._id;
    item.deletedAt = new Date();
    await item.save();

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete placement' });
  }
}
