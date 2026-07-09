import {
  getTicketForForm,
  publicFormPayload,
  saveResumeForm,
  enableFormEdit,
  ensureViewToken,
  emitTicketFormUpdate,
  buildResumeFormViewLink,
} from '../services/resumeForm.service.js';
import { formDataToRows } from '../constants/resumeForm.js';
import { ticketToJSON, buildResumeFormLink } from '../services/ticket.service.js';
import { parseResumeText } from '../services/gemini.service.js';
import Ticket from '../models/Ticket.js';

function canAccessTicket(user, ticket) {
  if (user.isPlatformAdmin) return true;
  const ticketCompanyId = ticket.companyId?._id?.toString() ?? ticket.companyId?.toString();
  return ticketCompanyId === user.companyId._id.toString();
}

export async function getPublicForm(req, res) {
  try {
    const ticket = await getTicketForForm(req.params.ticketId);
    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({ error: 'Form not found' });
    }
    if (ticket.ticketType !== 'new_resume') {
      return res.status(400).json({ error: 'This ticket does not have a resume form' });
    }
    return res.json(publicFormPayload(ticket));
  } catch (err) {
    console.error('Get public form error:', err);
    return res.status(500).json({ error: 'Failed to load form' });
  }
}

export async function savePublicForm(req, res) {
  try {
    const { action = 'save_exit', formData } = req.body;
    const ticket = await getTicketForForm(req.params.ticketId);
    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({ error: 'Form not found' });
    }

    await saveResumeForm(ticket, formData || {}, action);
    const refreshed = await getTicketForForm(ticket._id);
    emitTicketFormUpdate(refreshed);

    return res.json({
      success: true,
      ...publicFormPayload(refreshed),
    });
  } catch (err) {
    console.error('Save public form error:', err);
    return res.status(400).json({ error: err.message || 'Failed to save form' });
  }
}

export async function getSharedFormView(req, res) {
  try {
    const ticket = await Ticket.findOne({ resumeFormViewToken: req.params.token })
      .populate('companyId', 'name logoUrl primaryColor');

    if (!ticket || ticket.isDeleted || !ticket.resumeFormData) {
      return res.status(404).json({ error: 'Shared form not found' });
    }

    return res.json({
      ticketNumber: ticket.ticketNumber,
      candidateName: ticket.candidateName,
      companyName: ticket.companyId?.name || '',
      companyLogo: ticket.companyId?.logoUrl || '',
      resumeFormStatus: ticket.resumeFormStatus,
      rows: formDataToRows(ticket.resumeFormData),
      formData: ticket.resumeFormData,
    });
  } catch (err) {
    console.error('Shared form view error:', err);
    return res.status(500).json({ error: 'Failed to load shared form' });
  }
}

export async function enableFormEditAuth(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('companyId', 'name');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await enableFormEdit(ticket);
    const refreshed = await Ticket.findById(ticket._id).populate('companyId', 'name');
    emitTicketFormUpdate(refreshed);

    return res.json({
      ticket: ticketToJSON(refreshed, {
        companyName: refreshed.companyId?.name,
        resumeFormLink: buildResumeFormLink(refreshed._id),
      }),
    });
  } catch (err) {
    console.error('Enable form edit error:', err);
    return res.status(500).json({ error: 'Failed to enable form edit' });
  }
}

export async function getFormShareLink(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const token = await ensureViewToken(ticket);
    return res.json({
      resumeFormViewLink: buildResumeFormViewLink(token),
      resumeFormViewToken: token,
    });
  } catch (err) {
    console.error('Share link error:', err);
    return res.status(500).json({ error: 'Failed to generate share link' });
  }
}

export async function parseResume(req, res) {
  try {
    const { text } = req.body;
    const result = await parseResumeText(text);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Parse resume error:', err);
    return res.status(400).json({ error: err.message || 'Failed to parse resume' });
  }
}
