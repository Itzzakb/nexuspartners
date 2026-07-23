import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import TicketHistory from '../models/TicketHistory.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Student from '../models/Student.js';
import RecruiterAccount from '../models/RecruiterAccount.js';
import ExternalTicketRequest from '../models/ExternalTicketRequest.js';
import { normalizePhone } from '../services/nexusStudentApi.service.js';
import { TICKET_STAGES } from '../constants/ticket.js';
import {
  generateTicketNumber,
  addTicketHistory,
  ticketToJSON,
  buildResumeFormLink,
  mapExternalBody,
} from '../services/ticket.service.js';
import { emitTicketEvent } from '../services/socket.service.js';

function buildListFilter(query, user) {
  const filter = { isDeleted: false };

  if (!user.isPlatformAdmin) {
    filter.companyId = user.companyId._id;
  } else if (query.companyId) {
    filter.companyId = query.companyId;
  }

  const view = query.view || 'all';

  switch (view) {
    case 'new_resumes':
      filter.ticketType = 'new_resume';
      filter.currentStage = 'ticket_created';
      break;
    case 'existing_resume':
      filter.ticketType = 'existing_resume';
      filter.currentStage = { $ne: 'onboarded_successfully' };
      break;
    case 'my_tickets':
      filter.assignedTo = user._id;
      filter.currentStage = { $ne: 'onboarded_successfully' };
      break;
    case 'waiting_for_approval':
      filter.currentStage = 'waiting_for_approval';
      break;
    case 'group_created':
      filter.currentStage = 'group_created';
      break;
    case 'sent_to_onboarding':
      filter.currentStage = 'sent_to_onboarding';
      break;
    case 'onboarded':
      filter.currentStage = 'onboarded_successfully';
      break;
    case 'deleted':
      return {
        isDeleted: true,
        ...(user.isPlatformAdmin
          ? query.companyId
            ? { companyId: query.companyId }
            : {}
          : { companyId: user.companyId._id }),
      };
    case 'all':
    default:
      filter.currentStage = { $ne: 'onboarded_successfully' };
      break;
  }

  if (query.stage) filter.currentStage = query.stage;
  if (query.ticketType) filter.ticketType = query.ticketType;
  if (query.assignedTo === 'unallocated') filter.assignedTo = null;
  else if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.noChatLink === 'true') filter.$or = [{ chatLink: '' }, { chatLink: { $exists: false } }];
  if (query.hasChatLink === 'true') filter.chatLink = { $ne: '' };

  return filter;
}

export async function listTickets(req, res) {
  try {
    const filter = buildListFilter(req.query, req.user);
    const tickets = await Ticket.find(filter)
      .populate('companyId', 'name slug logoUrl')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('deletedBy', 'name email')
      .sort(filter.isDeleted ? { deletedAt: -1, updatedAt: -1 } : { createdAt: -1 });

    return res.json({
      tickets: tickets.map((t) =>
        ticketToJSON(t, {
          req,
          companyName: t.companyId?.name,
          resumeFormLink: buildResumeFormLink(t._id, req),
        })
      ),
    });
  } catch (err) {
    console.error('List tickets error:', err);
    return res.status(500).json({ error: 'Failed to list tickets' });
  }
}

export async function getTicketStats(req, res) {
  try {
    const baseFilter = userCompanyFilter(req.user);
    const tickets = await Ticket.find({ ...baseFilter, isDeleted: false });

    const stats = {
      total: tickets.length,
      pending: tickets.filter((t) =>
        ['ticket_created', 'group_created', 'waiting_for_approval'].includes(t.currentStage)
      ).length,
      waitingForApproval: tickets.filter((t) => t.currentStage === 'waiting_for_approval').length,
      completed: tickets.filter((t) => t.currentStage === 'onboarded_successfully').length,
      sentToOnboarding: tickets.filter((t) => t.currentStage === 'sent_to_onboarding').length,
    };

    return res.json({ stats });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Failed to get stats' });
  }
}

function parseActivityDays(range) {
  if (range === '7d') return 7;
  if (range === '3m') return 90;
  return 30;
}

function dayKey(date) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function trendPct(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getTicketDashboard(req, res) {
  try {
    const range = req.query.range || '30d';
    const days = parseActivityDays(range);
    const baseFilter = userCompanyFilter(req.user);
    const tickets = await Ticket.find({ ...baseFilter, isDeleted: false })
      .populate('companyId', 'name')
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 });

    const now = new Date();
    const last30 = startOfDay(new Date(now.getTime() - 30 * 86400000));
    const prev30 = startOfDay(new Date(now.getTime() - 60 * 86400000));

    const inRange = (t, start, end) => {
      const created = new Date(t.createdAt);
      return created >= start && created < end;
    };

    const createdLast30 = tickets.filter((t) => inRange(t, last30, now)).length;
    const createdPrev30 = tickets.filter((t) => inRange(t, prev30, last30)).length;

    const pendingNow = tickets.filter((t) => t.currentStage === 'ticket_created').length;
    const pendingLast30 = tickets.filter(
      (t) => t.currentStage === 'ticket_created' && inRange(t, last30, now)
    ).length;
    const pendingPrev30 = tickets.filter(
      (t) => t.currentStage === 'ticket_created' && inRange(t, prev30, last30)
    ).length;

    const waitingNow = tickets.filter((t) => t.currentStage === 'waiting_for_approval').length;
    const waitingLast30 = tickets.filter(
      (t) => t.currentStage === 'waiting_for_approval' && inRange(t, last30, now)
    ).length;
    const waitingPrev30 = tickets.filter(
      (t) => t.currentStage === 'waiting_for_approval' && inRange(t, prev30, last30)
    ).length;

    const completedLast30 = tickets.filter(
      (t) => t.currentStage === 'onboarded_successfully' && new Date(t.updatedAt) >= last30
    ).length;
    const completedPrev30 = tickets.filter(
      (t) =>
        t.currentStage === 'onboarded_successfully' &&
        new Date(t.updatedAt) >= prev30 &&
        new Date(t.updatedAt) < last30
    ).length;

    const activityStart = startOfDay(new Date(now.getTime() - days * 86400000));
    const buckets = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date(activityStart);
      d.setDate(d.getDate() + i);
      buckets[dayKey(d)] = 0;
    }
    tickets.forEach((t) => {
      const created = new Date(t.createdAt);
      if (created >= activityStart) {
        const key = dayKey(created);
        if (buckets[key] !== undefined) buckets[key]++;
      }
    });

    const recentTickets = tickets
      .filter((t) => t.currentStage !== 'onboarded_successfully')
      .slice(0, 5)
      .map((t) =>
        ticketToJSON(t, {
          req,
          companyName: t.companyId?.name,
          resumeFormLink: buildResumeFormLink(t._id, req),
        })
      );

    return res.json({
      stats: {
        total: tickets.length,
        pending: tickets.filter((t) => t.currentStage === 'ticket_created').length,
        waitingForApproval: waitingNow,
        completed: tickets.filter((t) => t.currentStage === 'onboarded_successfully').length,
        sentToOnboarding: tickets.filter((t) => t.currentStage === 'sent_to_onboarding').length,
      },
      trends: {
        total: { value: trendPct(createdLast30, createdPrev30), label: 'Last 30 days' },
        pending: { value: trendPct(pendingLast30, pendingPrev30), label: 'Ticket created stage' },
        waiting: { value: trendPct(waitingLast30, waitingPrev30), label: 'Pending approval' },
        completed: { value: trendPct(completedLast30, completedPrev30), label: 'Onboarding complete' },
      },
      activity: Object.entries(buckets).map(([date, count]) => ({ date, count })),
      recentTickets,
      activeTicketCount: tickets.filter((t) => t.currentStage !== 'onboarded_successfully').length,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

function userCompanyFilter(user) {
  if (user.isPlatformAdmin) return {};
  return { companyId: user.companyId._id };
}

export async function getTicket(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('companyId', 'name slug logoUrl')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email');

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = await TicketHistory.find({ ticketId: ticket._id })
      .populate('changedBy', 'name')
      .sort({ createdAt: -1 });

    const recruiterExtras = await recruiterExtrasForTicket(ticket);

    return res.json({
      ticket: ticketToJSON(ticket, {
        req,
        companyName: ticket.companyId?.name,
        resumeFormLink: buildResumeFormLink(ticket._id, req),
        ...recruiterExtras,
      }),
      history: history.map((h) => ({
        id: h._id.toString(),
        fromStage: h.fromStage,
        toStage: h.toStage,
        note: h.note,
        changedByName: h.changedByName || h.changedBy?.name || 'System',
        createdAt: h.createdAt,
        metadata: h.metadata,
      })),
    });
  } catch (err) {
    console.error('Get ticket error:', err);
    return res.status(500).json({ error: 'Failed to get ticket' });
  }
}

function canAccessTicket(user, ticket) {
  if (user.isPlatformAdmin) return true;
  const ticketCompanyId = ticket.companyId?._id?.toString() ?? ticket.companyId?.toString();
  return ticketCompanyId === user.companyId._id.toString();
}

function canAssignRecruiter(user) {
  return (
    user.isPlatformAdmin ||
    user.isCompanyAdmin ||
    user.role === 'onboarding'
  );
}

async function recruiterExtrasForTicket(ticket) {
  if (!ticket.studentId) {
    return { recruiterUsername: '', recruiterName: '' };
  }

  const student = await Student.findById(ticket.studentId).select('recruiterUsername');
  if (!student?.recruiterUsername) {
    return { recruiterUsername: '', recruiterName: '' };
  }

  const companyId = ticket.companyId?._id ?? ticket.companyId;
  const recruiter = await RecruiterAccount.findOne({
    companyId,
    username: student.recruiterUsername.toLowerCase(),
  }).select('name username');

  return {
    recruiterUsername: student.recruiterUsername,
    recruiterName: recruiter?.name || student.recruiterUsername,
  };
}

export async function createTicket(req, res) {
  try {
    const {
      ticketType,
      candidateName,
      phone,
      email,
      dueDate,
      notes,
      chatLink,
      studentId,
      studentPhone,
      studentProfileLink,
      companyId,
    } = req.body;

    if (!candidateName) {
      return res.status(400).json({ error: 'Candidate name is required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) {
      targetCompanyId = companyId;
    }

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    let linkedStudent = null;
    if (studentId) {
      linkedStudent = await Student.findOne({ _id: studentId, companyId: company._id });
      if (!linkedStudent) {
        return res.status(400).json({ error: 'Selected student does not belong to this company' });
      }
    } else if (ticketType === 'existing_resume' && phone) {
      linkedStudent = await Student.findOne({
        companyId: company._id,
        phoneNormalized: normalizePhone(phone),
      });
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await Ticket.create({
      ticketNumber,
      ticketType: ticketType || 'new_resume',
      candidateName,
      phone: phone || '',
      email: email || '',
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || '',
      chatLink: chatLink || '',
      studentId: linkedStudent?._id || null,
      studentPhone: linkedStudent?.phone || studentPhone || '',
      studentProfileLink: studentProfileLink || '',
      companyId: company._id,
      createdBy: req.user._id,
      currentStage: 'ticket_created',
    });

    await addTicketHistory({
      ticketId: ticket._id,
      fromStage: null,
      toStage: 'ticket_created',
      note: 'Ticket created',
      changedBy: req.user._id,
      changedByName: req.user.name,
    });

    const populated = await Ticket.findById(ticket._id)
      .populate('companyId', 'name')
      .populate('createdBy', 'name')
      .populate('assignedTo', 'name');

    const json = ticketToJSON(populated, {
      req,
      companyName: company.name,
      resumeFormLink: buildResumeFormLink(ticket._id, req),
    });

    emitTicketEvent(company._id.toString(), 'ticket:created', { ticket: json });

    return res.status(201).json({ ticket: json });
  } catch (err) {
    console.error('Create ticket error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate ticket number, please retry' });
    }
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
}

export async function createExternalTicket(req, res) {
  try {
    const apiSecret = req.headers['x-api-secret'];
    if (!apiSecret || apiSecret !== process.env.EXTERNAL_API_SECRET) {
      return res.status(401).json({ error: 'Invalid or missing API secret' });
    }

    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;
    if (idempotencyKey) {
      const existing = await ExternalTicketRequest.findOne({ idempotencyKey });
      if (existing) {
        const ticket = await Ticket.findById(existing.ticketId).populate('companyId', 'name');
        if (ticket) {
          return res.status(200).json({
            success: true,
            duplicate: true,
            ticket: {
              ...ticketToJSON(ticket, {
                req,
                companyName: ticket.companyId?.name,
                resumeFormLink: buildResumeFormLink(ticket._id, req),
              }),
            },
          });
        }
      }
    }

    const mapped = mapExternalBody(req.body);
    if (!mapped.candidateName) {
      return res.status(400).json({ error: 'Candidate name is required' });
    }

    const company = await Company.findOne({ slug: 'nexuspartners' });
    if (!company) {
      return res.status(500).json({ error: 'nexus partners company not configured. Run npm run seed.' });
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await Ticket.create({
      ticketNumber,
      ticketType: mapped.ticketType,
      candidateName: mapped.candidateName,
      phone: mapped.phone,
      email: mapped.email,
      dueDate: mapped.dueDate ? new Date(mapped.dueDate) : null,
      notes: mapped.notes,
      companyId: company._id,
      createdBy: null,
      createdByLabel: 'nexuspartnersus',
      externalSource: 'nexuspartnersus',
      currentStage: 'ticket_created',
    });

    await addTicketHistory({
      ticketId: ticket._id,
      fromStage: null,
      toStage: 'ticket_created',
      note: 'Auto-created via external API',
      changedByName: 'nexuspartnersus',
    });

    if (idempotencyKey) {
      await ExternalTicketRequest.create({
        idempotencyKey,
        ticketId: ticket._id,
        source: 'nexuspartnersus',
      });
    }

    const populated = await Ticket.findById(ticket._id).populate('companyId', 'name');
    const json = ticketToJSON(populated, {
      req,
      companyName: company.name,
      resumeFormLink: buildResumeFormLink(ticket._id, req),
    });

    emitTicketEvent(company._id.toString(), 'ticket:created', { ticket: json });

    return res.status(201).json({ success: true, ticket: json });
  } catch (err) {
    console.error('External create error:', err);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
}

export async function updateTicket(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    const { candidateName, phone, email, dueDate, notes, chatLink, onboardingSuccessful, sendBackReason, studentId, studentPhone, studentProfileLink } = req.body;

    if (candidateName !== undefined) ticket.candidateName = candidateName;
    if (phone !== undefined) ticket.phone = phone;
    if (email !== undefined) ticket.email = email;
    if (dueDate !== undefined) ticket.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) ticket.notes = notes;
    if (chatLink !== undefined) ticket.chatLink = chatLink;
    if (studentId !== undefined) ticket.studentId = studentId || null;
    if (studentPhone !== undefined) ticket.studentPhone = studentPhone;
    if (studentProfileLink !== undefined) ticket.studentProfileLink = studentProfileLink;
    if (onboardingSuccessful !== undefined) ticket.onboardingSuccessful = onboardingSuccessful;
    if (sendBackReason !== undefined) ticket.sendBackReason = sendBackReason;

    await ticket.save();

    const populated = await populateTicket(ticket._id);
    const json = ticketToJSON(populated, { req, resumeFormLink: buildResumeFormLink(ticket._id, req) });
    emitTicketEvent(ticket.companyId.toString(), 'ticket:updated', { ticket: json });

    return res.json({ ticket: json });
  } catch (err) {
    console.error('Update ticket error:', err);
    return res.status(500).json({ error: 'Failed to update ticket' });
  }
}

export async function changeStage(req, res) {
  try {
    const { stage, note } = req.body;
    if (!stage || !TICKET_STAGES.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    const fromStage = ticket.currentStage;
    ticket.currentStage = stage;
    await ticket.save();

    await addTicketHistory({
      ticketId: ticket._id,
      fromStage,
      toStage: stage,
      note: note || `Stage changed to ${stage}`,
      changedBy: req.user._id,
      changedByName: req.user.name,
    });

    const populated = await populateTicket(ticket._id);
    const json = ticketToJSON(populated, { req, resumeFormLink: buildResumeFormLink(ticket._id, req) });
    emitTicketEvent(ticket.companyId.toString(), 'ticket:stage_changed', { ticket: json });

    return res.json({ ticket: json });
  } catch (err) {
    console.error('Change stage error:', err);
    return res.status(500).json({ error: 'Failed to change stage' });
  }
}

export async function assignRecruiter(req, res) {
  try {
    if (!canAssignRecruiter(req.user)) {
      return res.status(403).json({ error: 'Only onboarding team can assign recruiters' });
    }

    const { recruiterUsername } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    if (!ticket.studentId) {
      return res.status(400).json({ error: 'Create or link a student before assigning a recruiter' });
    }

    const student = await Student.findOne({ _id: ticket.studentId, companyId: ticket.companyId });
    if (!student) return res.status(404).json({ error: 'Linked student not found' });

    const username = String(recruiterUsername || '').trim().toLowerCase();
    if (username) {
      const recruiter = await RecruiterAccount.findOne({
        companyId: ticket.companyId,
        username,
        isActive: true,
      });
      if (!recruiter) {
        return res.status(400).json({ error: 'Recruiter not found or inactive' });
      }
    }

    const previous = student.recruiterUsername || '';
    student.recruiterUsername = username;
    await student.save();

    await addTicketHistory({
      ticketId: ticket._id,
      fromStage: ticket.currentStage,
      toStage: ticket.currentStage,
      note: username ? `Recruiter assigned: @${username}` : 'Recruiter unassigned',
      changedBy: req.user._id,
      changedByName: req.user.name,
      metadata: { recruiterUsername: username, previousRecruiterUsername: previous },
    });

    const populated = await populateTicket(ticket._id);
    const recruiterExtras = await recruiterExtrasForTicket(populated);
    const json = ticketToJSON(populated, {
      req,
      resumeFormLink: buildResumeFormLink(ticket._id, req),
      ...recruiterExtras,
    });
    emitTicketEvent(ticket.companyId.toString(), 'ticket:recruiter_assigned', { ticket: json });

    return res.json({
      ticket: json,
      student: { id: student._id.toString(), recruiterUsername: username },
    });
  } catch (err) {
    console.error('Assign recruiter error:', err);
    return res.status(500).json({ error: 'Failed to assign recruiter' });
  }
}

export async function assignTicket(req, res) {
  try {
    const { assignedTo } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    if (assignedTo) {
      const assignee = await User.findById(assignedTo);
      if (!assignee || assignee.role !== 'resume') {
        return res.status(400).json({ error: 'Invalid resume team member' });
      }
      if (!req.user.isPlatformAdmin && assignee.companyId.toString() !== ticket.companyId.toString()) {
        return res.status(400).json({ error: 'Assignee must be in the same company' });
      }
    }

    ticket.assignedTo = assignedTo || null;
    await ticket.save();

    await addTicketHistory({
      ticketId: ticket._id,
      fromStage: ticket.currentStage,
      toStage: ticket.currentStage,
      note: assignedTo ? 'Ticket assigned' : 'Ticket unassigned',
      changedBy: req.user._id,
      changedByName: req.user.name,
      metadata: { assignedTo },
    });

    const populated = await populateTicket(ticket._id);
    const json = ticketToJSON(populated, { req, resumeFormLink: buildResumeFormLink(ticket._id, req) });
    emitTicketEvent(ticket.companyId.toString(), 'ticket:assigned', { ticket: json });

    return res.json({ ticket: json });
  } catch (err) {
    console.error('Assign error:', err);
    return res.status(500).json({ error: 'Failed to assign ticket' });
  }
}

export async function addNote(req, res) {
  try {
    const { text, type = 'work' } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Note text is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    const note = {
      text: text.trim(),
      author: req.user._id,
      authorName: req.user.name,
      type,
      createdAt: new Date(),
    };

    if (type === 'onboarding') ticket.onboardingNotes.push(note);
    else ticket.workNotes.push(note);

    await ticket.save();

    const populated = await populateTicket(ticket._id);
    const json = ticketToJSON(populated, { req, resumeFormLink: buildResumeFormLink(ticket._id, req) });
    emitTicketEvent(ticket.companyId.toString(), 'ticket:updated', { ticket: json });

    return res.json({ ticket: json });
  } catch (err) {
    console.error('Add note error:', err);
    return res.status(500).json({ error: 'Failed to add note' });
  }
}

export async function addResumeFile(req, res) {
  try {
    const { name, url, type = 'file' } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    ticket.resumeFiles.push({
      name: name || 'Resume file',
      url,
      type,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    });
    await ticket.save();

    const populated = await populateTicket(ticket._id);
    const json = ticketToJSON(populated, { req, resumeFormLink: buildResumeFormLink(ticket._id, req) });
    emitTicketEvent(ticket.companyId.toString(), 'ticket:updated', { ticket: json });

    return res.json({ ticket: json });
  } catch (err) {
    console.error('Add file error:', err);
    return res.status(500).json({ error: 'Failed to add file' });
  }
}

export async function deleteTicket(req, res) {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Delete reason is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    ticket.isDeleted = true;
    ticket.deleteReason = reason.trim();
    ticket.deletedBy = req.user._id;
    ticket.deletedAt = new Date();
    await ticket.save();

    await addTicketHistory({
      ticketId: ticket._id,
      fromStage: ticket.currentStage,
      toStage: ticket.currentStage,
      note: `Deleted: ${reason}`,
      changedBy: req.user._id,
      changedByName: req.user.name,
    });

    emitTicketEvent(ticket.companyId.toString(), 'ticket:deleted', { ticketId: ticket._id.toString() });

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete ticket error:', err);
    return res.status(500).json({ error: 'Failed to delete ticket' });
  }
}

export async function restoreTicket(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || !ticket.isDeleted) {
      return res.status(404).json({ error: 'Deleted ticket not found' });
    }
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    ticket.isDeleted = false;
    ticket.deleteReason = '';
    ticket.deletedBy = null;
    ticket.deletedAt = null;
    await ticket.save();

    await addTicketHistory({
      ticketId: ticket._id,
      fromStage: ticket.currentStage,
      toStage: ticket.currentStage,
      note: 'Ticket restored',
      changedBy: req.user._id,
      changedByName: req.user.name,
    });

    const populated = await Ticket.findById(ticket._id)
      .populate('companyId', 'name slug logoUrl')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email');

    emitTicketEvent(ticket.companyId.toString(), 'ticket:updated', {
      ticketId: ticket._id.toString(),
    });

    return res.json({
      success: true,
      ticket: ticketToJSON(populated, {
        req,
        companyName: populated.companyId?.name,
        resumeFormLink: buildResumeFormLink(populated._id, req),
      }),
    });
  } catch (err) {
    console.error('Restore ticket error:', err);
    return res.status(500).json({ error: 'Failed to restore ticket' });
  }
}

export async function getResumeTeam(req, res) {
  try {
    let companyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && req.query.companyId) {
      companyId = req.query.companyId;
    }

    const members = await User.find({
      companyId,
      role: 'resume',
      isActive: true,
    }).select('name email id');

    return res.json({
      members: members.map((m) => ({
        id: m._id.toString(),
        name: m.name,
        email: m.email,
      })),
    });
  } catch (err) {
    console.error('Resume team error:', err);
    return res.status(500).json({ error: 'Failed to get resume team' });
  }
}

async function populateTicket(id) {
  return Ticket.findById(id)
    .populate('companyId', 'name slug logoUrl')
    .populate('createdBy', 'name email')
    .populate('assignedTo', 'name email');
}
