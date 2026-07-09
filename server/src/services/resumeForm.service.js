import Ticket from '../models/Ticket.js';
import { emptyResumeFormData, computeFormStatus } from '../constants/resumeForm.js';
import { ticketToJSON, buildResumeFormLink } from './ticket.service.js';
import { emitTicketEvent } from './socket.service.js';
import crypto from 'crypto';

export function buildResumeFormViewLink(token) {
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  return `${base}/resume-form-view/${token}`;
}

export async function getTicketForForm(ticketId) {
  return Ticket.findById(ticketId)
    .populate('companyId', 'name slug logoUrl primaryColor secondaryColor appTitle');
}

export function publicFormPayload(ticket) {
  const company = ticket.companyId;
  const formData = ticket.resumeFormData || emptyResumeFormData();
  const locked = ticket.resumeFormStatus === 'completed' && !ticket.resumeFormEditEnabled;

  return {
    ticketId: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber,
    candidateName: ticket.candidateName,
    company: {
      name: company?.name || '',
      logoUrl: company?.logoUrl || '',
      primaryColor: company?.primaryColor || '#3e6ae1',
      secondaryColor: company?.secondaryColor || '#7c3aed',
      appTitle: company?.appTitle || company?.name || '',
    },
    formData,
    resumeFormStatus: ticket.resumeFormStatus,
    resumeFormEditEnabled: ticket.resumeFormEditEnabled,
    locked,
  };
}

export async function saveResumeForm(ticket, body, action) {
  if (ticket.ticketType !== 'new_resume') {
    throw new Error('Resume form is only available for new resume tickets');
  }

  const locked = ticket.resumeFormStatus === 'completed' && !ticket.resumeFormEditEnabled;
  if (locked && action !== 'reset') {
    throw new Error('Form is locked. Contact your team to enable editing.');
  }

  if (action === 'reset') {
    ticket.resumeFormData = emptyResumeFormData();
    ticket.resumeFormStatus = 'unfilled';
    ticket.resumeFormEditEnabled = false;
    await ticket.save();
    return ticket;
  }

  const merged = {
    ...(ticket.resumeFormData || emptyResumeFormData()),
    ...body,
    workExperience: body.workExperience || ticket.resumeFormData?.workExperience || [emptyResumeFormData().workExperience[0]],
  };

  ticket.resumeFormData = merged;
  ticket.resumeFormStatus = computeFormStatus(merged, action);

  if (action === 'complete' && ticket.resumeFormStatus !== 'completed') {
    throw new Error('Please fill all required fields and accept both consent checkboxes before completing.');
  }

  if (action === 'complete') {
    ticket.resumeFormEditEnabled = false;
  }

  await ticket.save();
  return ticket;
}

export async function enableFormEdit(ticket) {
  ticket.resumeFormEditEnabled = true;
  await ticket.save();
  return ticket;
}

export async function ensureViewToken(ticket) {
  if (!ticket.resumeFormViewToken) {
    ticket.resumeFormViewToken = crypto.randomUUID();
    await ticket.save();
  }
  return ticket.resumeFormViewToken;
}

export function emitTicketFormUpdate(ticket) {
  const json = ticketToJSON(ticket, {
    companyName: ticket.companyId?.name,
    resumeFormLink: buildResumeFormLink(ticket._id),
    resumeFormViewLink: ticket.resumeFormViewToken
      ? buildResumeFormViewLink(ticket.resumeFormViewToken)
      : '',
  });
  emitTicketEvent(ticket.companyId._id?.toString() || ticket.companyId.toString(), 'ticket:updated', {
    ticket: json,
  });
}
