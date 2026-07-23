import mongoose from 'mongoose';
import Counter from '../models/Counter.js';
import TicketHistory from '../models/TicketHistory.js';
import { computeFormStatus, formDataToRows } from '../constants/resumeForm.js';
import { getClientBaseUrl } from '../utils/publicUrls.js';

export function buildResumeFormViewLink(token, req) {
  const base = getClientBaseUrl(req);
  return `${base}/resume-form-view/${token}`;
}

export async function generateTicketNumber() {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'ticket_number' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    await session.commitTransaction();
    return `TKT-${String(counter.seq).padStart(3, '0')}`;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function addTicketHistory({
  ticketId,
  fromStage,
  toStage,
  note = '',
  changedBy = null,
  changedByName = '',
  metadata = {},
}) {
  return TicketHistory.create({
    ticketId,
    fromStage,
    toStage,
    note,
    changedBy,
    changedByName,
    metadata,
  });
}

export function ticketToJSON(ticket, extras = {}) {
  const obj = ticket.toObject ? ticket.toObject() : ticket;
  return {
    id: obj._id?.toString?.() ?? obj.id,
    ticketNumber: obj.ticketNumber,
    ticketType: obj.ticketType,
    candidateName: obj.candidateName,
    phone: obj.phone,
    email: obj.email,
    dueDate: obj.dueDate,
    notes: obj.notes,
    chatLink: obj.chatLink,
    studentId:
      obj.studentId?._id?.toString?.() ?? obj.studentId?.toString?.() ?? obj.studentId ?? null,
    studentPhone: obj.studentPhone || '',
    studentProfileLink: obj.studentProfileLink || '',
    currentStage: obj.currentStage,
    companyId: obj.companyId?._id?.toString?.() ?? obj.companyId?.toString?.() ?? obj.companyId,
    companyName: obj.companyId?.name ?? extras.companyName ?? '',
    createdBy: obj.createdBy?._id?.toString?.() ?? obj.createdBy?.toString?.() ?? obj.createdBy,
    createdByName: obj.createdBy?.name ?? extras.createdByName ?? obj.createdByLabel ?? '',
    createdByLabel: obj.createdByLabel || '',
    assignedTo: obj.assignedTo?._id?.toString?.() ?? obj.assignedTo?.toString?.() ?? obj.assignedTo,
    assignedToName: obj.assignedTo?.name ?? extras.assignedToName ?? '',
    resumeFiles: obj.resumeFiles || [],
    workNotes: (obj.workNotes || []).map((n) => ({
      id: n._id?.toString(),
      text: n.text,
      authorName: n.authorName,
      type: n.type,
      createdAt: n.createdAt,
    })),
    onboardingNotes: (obj.onboardingNotes || []).map((n) => ({
      id: n._id?.toString(),
      text: n.text,
      authorName: n.authorName,
      createdAt: n.createdAt,
    })),
    onboardingSuccessful: obj.onboardingSuccessful,
    sendBackReason: obj.sendBackReason,
    resumeFormToken: obj.resumeFormToken,
    // Stored DB status (used for Enable Form Edit / lock)
    resumeFormStatusStored: obj.resumeFormStatus,
    // Effective status from current form fields (may be partial after new required fields)
    resumeFormStatus: obj.resumeFormData
      ? computeFormStatus(obj.resumeFormData)
      : obj.resumeFormStatus,
    resumeFormEditEnabled: obj.resumeFormEditEnabled ?? false,
    resumeFormData: obj.resumeFormData || null,
    resumeFormRows: obj.resumeFormData ? formDataToRows(obj.resumeFormData) : [],
    resumeFormViewLink: obj.resumeFormViewToken
      ? buildResumeFormViewLink(obj.resumeFormViewToken, extras.req)
      : extras.resumeFormViewLink ?? '',
    resumeFormLink:
      extras.resumeFormLink ??
      (obj._id ? buildResumeFormLink(obj._id, extras.req) : ''),
    recruiterUsername: extras.recruiterUsername ?? '',
    recruiterName: extras.recruiterName ?? '',
    isDeleted: obj.isDeleted,
    deleteReason: obj.deleteReason || '',
    deletedBy: obj.deletedBy?._id?.toString?.() ?? obj.deletedBy?.toString?.() ?? obj.deletedBy ?? null,
    deletedByName: obj.deletedBy?.name ?? extras.deletedByName ?? '',
    deletedAt: obj.deletedAt || null,
    externalSource: obj.externalSource,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export function buildResumeFormLink(ticketId, req) {
  const base = getClientBaseUrl(req);
  return `${base}/resume-form/${ticketId}`;
}

export function normalizeTicketType(input) {
  if (!input) return 'new_resume';
  const val = String(input).toLowerCase().replace(/\s+/g, '_');
  if (val === 'new' || val === 'new_resume') return 'new_resume';
  if (val === 'existing' || val === 'existing_resume') return 'existing_resume';
  return val;
}

export function mapExternalBody(body) {
  return {
    ticketType: normalizeTicketType(
      body.ticket_type || body['Ticket Type'] || body.ticketType
    ),
    candidateName: body.candidate_name || body['Candidate Name'] || body.candidateName,
    phone: body.phone_number || body['Phone Number'] || body.phone || '',
    email: body.email || body['Email'] || '',
    dueDate: body.due_date || body['Due Date'] || body.dueDate,
    notes: body.notes || body['Notes'] || '',
  };
}
