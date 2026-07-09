import Interview, { INTERVIEW_STAGES } from '../models/Interview.js';
import Company from '../models/Company.js';
import {
  generateInterviewNumber,
  getCompanyFilter,
  canAccessCompany,
  interviewToJSON,
  buildInterviewShareLink,
} from '../utils/phase4.helpers.js';
import { emitTicketEvent } from '../services/socket.service.js';

function buildInterviewFilter(query, user) {
  const base = { ...getCompanyFilter(user, query.companyId), isDeleted: false };
  const view = query.view || 'all';

  if (view === 'completed') {
    base.currentStage = 'interview_completed';
  } else if (view === 'all') {
    base.currentStage = { $ne: 'interview_completed' };
  }

  if (query.stage) base.currentStage = query.stage;
  if (query.movedForward === 'yes') base.movedForward = true;
  if (query.movedForward === 'no') base.movedForward = false;

  if (query.upcoming === '7') {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);
    base.interviewDateTime = { $gte: now, $lte: week };
    base.currentStage = { $ne: 'interview_completed' };
    base.isCancelled = false;
  }

  return base;
}

function emitInterview(companyId, event, payload) {
  emitTicketEvent(companyId, event, payload);
}

export async function listInterviews(req, res) {
  try {
    const filter = buildInterviewFilter(req.query, req.user);
    const items = await Interview.find(filter)
      .populate('companyId', 'name')
      .sort({ interviewDateTime: 1, createdAt: -1 });

    return res.json({
      interviews: items.map((i) =>
        interviewToJSON(i, { shareLink: buildInterviewShareLink(i.shareToken) })
      ),
    });
  } catch (err) {
    console.error('List interviews error:', err);
    return res.status(500).json({ error: 'Failed to list interviews' });
  }
}

export async function getInterviewStats(req, res) {
  try {
    const filter = { ...getCompanyFilter(req.user, req.query.companyId), isDeleted: false };
    const items = await Interview.find(filter);
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);

    return res.json({
      stats: {
        total: items.length,
        reported: items.filter((i) => i.currentStage === 'interview_reported').length,
        ready: items.filter((i) => i.currentStage === 'ready_for_interview').length,
        completed: items.filter((i) => i.currentStage === 'interview_completed').length,
        upcoming: items.filter(
          (i) => i.interviewDateTime && new Date(i.interviewDateTime) >= now && new Date(i.interviewDateTime) <= week
        ).length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get stats' });
  }
}

export async function getInterview(req, res) {
  try {
    const item = await Interview.findById(req.params.id).populate('companyId', 'name');
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Interview not found' });
    if (!canAccessCompany(req.user, item.companyId._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json({
      interview: interviewToJSON(item, { shareLink: buildInterviewShareLink(item.shareToken) }),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get interview' });
  }
}

export async function createInterview(req, res) {
  try {
    const {
      candidateName,
      phone,
      studentPhone,
      position,
      companyName,
      interviewDateTime,
      timezone,
      jobDescription,
      screenshotUrl,
      resumeFileUrl,
      companyId,
      isSelfInstruction,
    } = req.body;

    if (!candidateName) return res.status(400).json({ error: 'Candidate name is required' });

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const interviewNumber = await generateInterviewNumber();
    const item = await Interview.create({
      interviewNumber,
      candidateName,
      phone: phone || studentPhone || '',
      studentPhone: studentPhone || phone || '',
      position: position || '',
      companyName: companyName || '',
      interviewDateTime: interviewDateTime ? new Date(interviewDateTime) : null,
      timezone: timezone || 'America/New_York',
      jobDescription: jobDescription || '',
      screenshotUrl: screenshotUrl || '',
      resumeFileUrl: resumeFileUrl || '',
      isSelfInstruction: !!isSelfInstruction,
      companyId: company._id,
      createdBy: req.user._id,
    });

    const populated = await Interview.findById(item._id).populate('companyId', 'name');
    const json = interviewToJSON(populated, { shareLink: buildInterviewShareLink(item.shareToken) });
    emitInterview(company._id.toString(), 'interview:created', { interview: json });

    return res.status(201).json({ interview: json });
  } catch (err) {
    console.error('Create interview error:', err);
    return res.status(500).json({ error: 'Failed to create interview' });
  }
}

export async function updateInterview(req, res) {
  try {
    const item = await Interview.findById(req.params.id);
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Interview not found' });
    if (!canAccessCompany(req.user, item.companyId)) return res.status(403).json({ error: 'Access denied' });

    const fields = [
      'candidateName', 'phone', 'studentPhone', 'position', 'companyName',
      'timezone', 'jobDescription', 'screenshotUrl', 'resumeFileUrl',
      'isCancelled', 'isSelfInstruction', 'movedForward', 'movedForwardReason',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });
    if (req.body.interviewDateTime !== undefined) {
      item.interviewDateTime = req.body.interviewDateTime ? new Date(req.body.interviewDateTime) : null;
    }
    if (req.body.currentStage && INTERVIEW_STAGES.includes(req.body.currentStage)) {
      item.currentStage = req.body.currentStage;
    }

    await item.save();
    const populated = await Interview.findById(item._id).populate('companyId', 'name');
    const json = interviewToJSON(populated, { shareLink: buildInterviewShareLink(item.shareToken) });
    emitInterview(item.companyId.toString(), 'interview:updated', { interview: json });
    return res.json({ interview: json });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update interview' });
  }
}

export async function bulkInterviewAction(req, res) {
  try {
    const { ids, action, movedForward, movedForwardReason } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const items = await Interview.find({ _id: { $in: ids }, isDeleted: false });
    for (const item of items) {
      if (!canAccessCompany(req.user, item.companyId)) continue;
      if (action === 'complete') {
        item.currentStage = 'interview_completed';
        if (movedForward !== undefined) item.movedForward = movedForward;
        if (movedForwardReason) item.movedForwardReason = movedForwardReason;
      } else if (action === 'delete') {
        item.isDeleted = true;
        item.deletedBy = req.user._id;
        item.deletedAt = new Date();
      }
      await item.save();
    }

    return res.json({ success: true, count: items.length });
  } catch (err) {
    return res.status(500).json({ error: 'Bulk action failed' });
  }
}

export async function deleteInterview(req, res) {
  try {
    const item = await Interview.findById(req.params.id);
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Interview not found' });
    if (!canAccessCompany(req.user, item.companyId)) return res.status(403).json({ error: 'Access denied' });

    item.isDeleted = true;
    item.deletedReason = req.body.reason || '';
    item.deletedBy = req.user._id;
    item.deletedAt = new Date();
    await item.save();

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete interview' });
  }
}

export async function getSharedInterview(req, res) {
  try {
    const item = await Interview.findOne({ shareToken: req.params.token, isDeleted: false })
      .populate('companyId', 'name logoUrl');
    if (!item) return res.status(404).json({ error: 'Not found' });

    return res.json({
      interview: interviewToJSON(item, { companyLabel: item.companyId?.name }),
      companyLogo: item.companyId?.logoUrl || '',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load interview' });
  }
}
