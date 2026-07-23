import Ticket from '../models/Ticket.js';
import Student from '../models/Student.js';
import {
  emptyResumeFormData,
  computeFormStatus,
  normalizeResumeFormData,
  formatFormAddress,
} from '../constants/resumeForm.js';
import { ticketToJSON, buildResumeFormLink, buildResumeFormViewLink } from './ticket.service.js';
import { emitTicketEvent } from './socket.service.js';
import { buildResumeFromFormData } from './resumeEnrich.service.js';
import crypto from 'crypto';

export { buildResumeFormViewLink };

export async function getTicketForForm(ticketId) {
  return Ticket.findById(ticketId)
    .populate('companyId', 'name slug logoUrl primaryColor secondaryColor appTitle');
}

export function publicFormPayload(ticket) {
  const company = ticket.companyId;
  const formData = normalizeResumeFormData(ticket.resumeFormData || emptyResumeFormData());
  const effectiveStatus = computeFormStatus(formData);
  // Only lock when the form was completed under the *current* required fields.
  // Older submissions can become "partial" after new fields were added — keep those editable.
  const locked =
    ticket.resumeFormStatus === 'completed' &&
    effectiveStatus === 'completed' &&
    !ticket.resumeFormEditEnabled;

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
    resumeFormStatus: effectiveStatus,
    resumeFormEditEnabled: !!ticket.resumeFormEditEnabled,
    locked,
  };
}

/**
 * If stored status is "completed" but current required fields are incomplete
 * (e.g. form schema grew), open the form for edits and sync status.
 */
export async function reconcileResumeFormStatus(ticket) {
  if (!ticket?.resumeFormData) return ticket;
  const formData = normalizeResumeFormData(ticket.resumeFormData);
  const effectiveStatus = computeFormStatus(formData);

  if (ticket.resumeFormStatus === 'completed' && effectiveStatus !== 'completed') {
    ticket.resumeFormStatus = effectiveStatus;
    ticket.resumeFormEditEnabled = true;
    await ticket.save();
  }
  return ticket;
}

export async function saveResumeForm(ticket, body, action) {
  if (ticket.ticketType !== 'new_resume') {
    throw new Error('Resume form is only available for new resume tickets');
  }

  const formDataForLock = normalizeResumeFormData(ticket.resumeFormData || emptyResumeFormData());
  const effectiveStatus = computeFormStatus(formDataForLock);
  const locked =
    ticket.resumeFormStatus === 'completed' &&
    effectiveStatus === 'completed' &&
    !ticket.resumeFormEditEnabled;
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

  const merged = normalizeResumeFormData({
    ...(ticket.resumeFormData || emptyResumeFormData()),
    ...body,
    workExperience: body.workExperience ?? ticket.resumeFormData?.workExperience,
    internships: body.internships ?? ticket.resumeFormData?.internships,
    projects: body.projects ?? ticket.resumeFormData?.projects,
  });

  ticket.resumeFormData = merged;
  ticket.resumeFormStatus = computeFormStatus(merged, action);

  if (action === 'complete') {
    ticket.resumeFormEditEnabled = false;
  }

  await ticket.save();

  if (action === 'complete' || action === 'save_exit') {
    await syncLinkedStudentFromForm(ticket);
  }

  return ticket;
}

/**
 * Push latest resume-form fields into the linked student record.
 * Form saves alone only update the ticket; Build & Download uses student.resume.
 */
export async function syncLinkedStudentFromForm(ticket) {
  if (!ticket?.studentId || !ticket.resumeFormData) return null;

  const student = await Student.findById(ticket.studentId);
  if (!student) return null;

  const form = normalizeResumeFormData(ticket.resumeFormData);
  const resume = buildResumeFromFormData(form, ticket);
  const address = formatFormAddress(form);

  student.resume = resume;
  if (form.preferredName || form.legalName) {
    student.name = form.preferredName || form.legalName;
  }
  if (form.resumeEmail) student.email = form.resumeEmail;
  if (form.preferredRole) student.role = form.preferredRole;
  if (form.linkedIn) student.linkedin = form.linkedIn;
  if (form.city) student.city = form.city;
  if (form.state) student.state = form.state;
  if (form.visaStatus) student.visa = form.visaStatus;

  const details = [
    ['Date of Birth', form.dateOfBirth],
    ['Address', address],
    ['Visa Status', form.visaStatus],
    ['Date of Arrival USA', form.dateOfArrivalUSA],
    ['Certifications', form.certifications],
    ['Technical Skills', form.technicalSkills],
    ['Relevant Coursework', form.relevantCoursework],
    ['Professional Summary', form.professionalSummary],
    ['Masters University', form.mastersUniversity],
    ['Masters Field', form.mastersField],
    ['Bachelors University', form.bachelorsUniversity],
    ['Bachelors Field', form.bachelorsField],
  ]
    .filter(([, value]) => value)
    .map(([key, data]) => ({ key, data }));

  if (details.length) {
    const merged = [...(student.additionalDetails || [])];
    for (const item of details) {
      const idx = merged.findIndex((d) => d.key?.toLowerCase() === item.key.toLowerCase());
      if (idx >= 0) merged[idx] = item;
      else merged.push(item);
    }
    student.additionalDetails = merged;
  }

  await student.save();
  return student;
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
