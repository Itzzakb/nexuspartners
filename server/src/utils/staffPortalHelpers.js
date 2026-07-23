import Counter from '../models/Counter.js';
import { getClientBaseUrl } from './publicUrls.js';

export async function generateInterviewNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'interview_number' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `INT-${String(counter.seq).padStart(3, '0')}`;
}

export function getCompanyFilter(user, queryCompanyId) {
  if (user.isPlatformAdmin) {
    return queryCompanyId ? { companyId: queryCompanyId } : {};
  }
  return { companyId: user.companyId._id };
}

export function canAccessCompany(user, companyId) {
  if (user.isPlatformAdmin) return true;
  return companyId?.toString() === user.companyId._id.toString();
}

export function interviewToJSON(doc, extras = {}) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    interviewNumber: o.interviewNumber,
    candidateName: o.candidateName,
    phone: o.phone,
    studentPhone: o.studentPhone || o.phone,
    position: o.position,
    companyName: o.companyName,
    interviewDateTime: o.interviewDateTime,
    timezone: o.timezone,
    jobDescription: o.jobDescription,
    screenshotUrl: o.screenshotUrl,
    resumeFileUrl: o.resumeFileUrl,
    currentStage: o.currentStage,
    isCancelled: o.isCancelled,
    isSelfInstruction: o.isSelfInstruction,
    movedForward: o.movedForward,
    movedForwardReason: o.movedForwardReason,
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    companyLabel: o.companyId?.name ?? extras.companyLabel ?? '',
    createdBy: o.createdBy?.toString?.() ?? o.createdBy,
    shareToken: o.shareToken,
    shareLink: extras.shareLink ?? '',
    isDeleted: o.isDeleted,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function placementToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    candidateName: o.candidateName,
    email: o.email,
    mobile: o.mobile,
    companyName: o.companyName,
    placementDate: o.placementDate,
    durationMonths: o.durationMonths,
    documents: o.documents || [],
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    companyLabel: o.companyId?.name ?? '',
    isDeleted: o.isDeleted,
    deleteReason: o.deleteReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function teamToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    teamName: o.teamName,
    teamLeadName: o.teamLeadName,
    teamLeadPhone: o.teamLeadPhone,
    teamLeadEmail: o.teamLeadEmail,
    teamLeadUserId: o.teamLeadUserId?.toString?.() ?? o.teamLeadUserId,
    members: o.members || [],
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    companyLabel: o.companyId?.name ?? '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function buildInterviewShareLink(token, req) {
  const base = getClientBaseUrl(req);
  return `${base}/interview-share/${token}`;
}
