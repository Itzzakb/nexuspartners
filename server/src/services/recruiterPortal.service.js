import bcrypt from 'bcryptjs';
import RecruiterAccount from '../models/RecruiterAccount.js';
import StudentJobAction from '../models/StudentJobAction.js';
import ScrapedJob from '../models/ScrapedJob.js';
import StudentNote from '../models/StudentNote.js';
import Ticket from '../models/Ticket.js';
import PaymentRecord from '../models/PaymentRecord.js';
import SubscriptionSchedule from '../models/SubscriptionSchedule.js';
import {
  fetchRecruiterStudents,
  fetchStudentDetails,
  resolveApiCompanyName,
  buildResumeDownload,
  updateStudentResume,
  normalizePhone,
} from './nexusStudentApi.service.js';
import { scrapedJobToJSON, extractExperienceYears } from './jobScrap.service.js';
import { fixResumeForJob, scoreResumeAtsWithGemini, ATS_TARGET_SCORE } from './gemini.service.js';
import { getPromptByKey } from '../controllers/prompt.controller.js';
import RecruiterResumeLibrary from '../models/RecruiterResumeLibrary.js';
import Interview from '../models/Interview.js';
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TRACKER_STATUSES,
  isValidApplicationStatus,
} from '../constants/recruiterApplications.js';
import {
  computeFormStatus,
  formDataToCopyFields,
  formDataToRowsForStaff,
  normalizeResumeFormData,
} from '../constants/resumeForm.js';
import ResumeTemplate from '../models/ResumeTemplate.js';
import Student from '../models/Student.js';

const SALT_ROUNDS = 12;

export async function upsertRecruiterAccount({ username, password, name, email, phone, companyId }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return RecruiterAccount.findOneAndUpdate(
    { username: username.toLowerCase(), companyId },
    {
      username: username.toLowerCase(),
      passwordHash,
      name,
      email: email || '',
      phone: phone || '',
      companyId,
      isActive: true,
    },
    { upsert: true, new: true }
  );
}

export function normalizeRecruiterStudent(raw, companyId) {
  const phone = (raw.phone || raw.mobile || raw.studentid || '').toString();
  const name = (raw.name || raw.studentname || 'Unknown').toString();
  const role =
    (raw.jobtitle || raw.job_title || raw.role || raw.designation || raw.profile || '').toString();
  const city = (raw.city || '').toString();
  const state = (raw.state || '').toString();
  const location =
    (raw.location || raw.address || [city, state].filter(Boolean).join(', ') || '').toString();
  const email = (raw.email || '').toString();
  const isActive =
    raw.isactive === true ||
    raw.isActive === true ||
    raw.active === true ||
    String(raw.status || '').toLowerCase() === 'active';

  const resume = raw.resume;
  let resumeStatus = 'pending';
  if (resume && typeof resume === 'object') {
    const hasContent =
      !!(resume.jobtitle || resume.experience?.length || resume.education?.length || resume.professionalsummary_points?.length);
    resumeStatus = hasContent ? 'ready' : 'draft';
  } else if (!resume) {
    resumeStatus = 'pending';
  }

  return {
    phone,
    name,
    email,
    role,
    targetRole: role,
    city,
    state,
    location,
    isActive,
    resumeStatus,
    companyId,
    raw,
  };
}

function computeSubscriptionStatus(sub) {
  if (!sub) return 'none';
  if (sub.status !== 'active') return sub.status || 'none';
  if (sub.nextDueDate) {
    const due = new Date(sub.nextDueDate);
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    if (due <= inSevenDays) return 'expiring';
  }
  return 'active';
}

export async function listRecruiterStudents(
  recruiter,
  company,
  { q = '', subscriptionStatus = '', sort = 'name_asc' } = {}
) {
  const apiName = resolveApiCompanyName(company);
  let students = [];
  try {
    students = await fetchRecruiterStudents(recruiter.username);
  } catch {
    try {
      const { fetchStudents } = await import('./nexusStudentApi.service.js');
      students = await fetchStudents(apiName);
    } catch {
      students = [];
    }
  }

  let normalized = students.map((s) => normalizeRecruiterStudent(s, company._id.toString()));
  const phones = normalized.map((s) => s.phone).filter(Boolean);

  const [subscriptions, appCounts] = await Promise.all([
    SubscriptionSchedule.find({
      companyId: company._id,
      studentPhone: { $in: phones },
      status: 'active',
    }),
    StudentJobAction.aggregate([
      {
        $match: {
          companyId: company._id,
          recruiterUsername: recruiter.username,
          studentPhone: { $in: phones },
          status: {
            $in: [
              'applied',
              'interview_scheduled',
              'interview_completed',
              'offer_received',
              'hired',
              'rejected',
              'saved',
            ],
          },
        },
      },
      { $group: { _id: '$studentPhone', count: { $sum: 1 } } },
    ]),
  ]);

  const subByPhone = new Map(subscriptions.map((s) => [s.studentPhone, s]));
  const countByPhone = new Map(appCounts.map((c) => [c._id, c.count]));

  normalized = normalized.map((s) => {
    const sub = subByPhone.get(s.phone);
    const subscriptionStatusValue = computeSubscriptionStatus(sub);
    return {
      ...s,
      subscriptionStatus: subscriptionStatusValue,
      subscriptionStatusLabel:
        subscriptionStatusValue === 'active'
          ? 'Active'
          : subscriptionStatusValue === 'expiring'
            ? 'Expiring'
            : subscriptionStatusValue === 'none'
              ? 'None'
              : String(subscriptionStatusValue),
      applicationCount: countByPhone.get(s.phone) || 0,
      nextDueDate: sub?.nextDueDate || null,
    };
  });

  const query = q.trim().toLowerCase();
  if (query) {
    normalized = normalized.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.phone.includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.role.toLowerCase().includes(query)
    );
  }

  if (subscriptionStatus) {
    const wanted = String(subscriptionStatus).toLowerCase();
    normalized = normalized.filter((s) => s.subscriptionStatus === wanted);
  }

  if (sort === 'name_desc') {
    normalized.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'applications_desc') {
    normalized.sort((a, b) => b.applicationCount - a.applicationCount);
  } else if (sort === 'applications_asc') {
    normalized.sort((a, b) => a.applicationCount - b.applicationCount);
  } else {
    normalized.sort((a, b) => a.name.localeCompare(b.name));
  }

  return normalized;
}

function studentRoleKeywords(student) {
  const role = (student.role || student.jobtitle || '').trim();
  if (!role) return [];
  const words = role
    .split(/[\s,/|]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2);
  return [role, ...words].filter((v, i, arr) => arr.indexOf(v) === i);
}

function relativePostedAge(datePosted) {
  if (!datePosted) return '';
  const ms = Date.now() - new Date(datePosted).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

function detectVisaSponsorship(job) {
  const text = `${job.description || ''} ${job.notes || ''}`.toLowerCase();
  return /h1b|h-1b|visa sponsor|sponsorship/.test(text);
}

const SPONSORSHIP_MONGO_REGEX = /h1b|h-1b|visa sponsor|sponsorship/i;

const APPLIED_STATUSES = new Set([
  'applied',
  'interview_scheduled',
  'interview_completed',
  'offer_received',
  'hired',
  'rejected',
]);

export function enrichJobForRecruiter(json, jobDoc, action = null) {
  const sourceLabel =
    json.source === 'theirstack'
      ? 'Internal Scraper'
      : json.source === 'manual'
        ? 'Manual'
        : json.source || 'Internal Scraper';
  const tags = [];
  if (json.remote) tags.push('Remote');
  else if (json.hybrid) tags.push('Hybrid');
  const visaSponsorship = detectVisaSponsorship(jobDoc || json);
  if (visaSponsorship) tags.push('H1B Sponsor');

  const isApplied = Boolean(action && APPLIED_STATUSES.has(action.status));

  return {
    ...json,
    verified: true,
    sourceLabel,
    salaryRange: formatSalaryRange(jobDoc || json),
    postedAge: relativePostedAge(json.datePosted || json.createdAt),
    workType: json.remote ? 'Remote' : json.hybrid ? 'Hybrid' : 'Onsite',
    visaSponsorship,
    isSponsored: visaSponsorship,
    isApplied,
    tags,
    metaLine: [
      json.companyName,
      json.remote ? 'Remote' : json.location || '',
      json.countryCode,
      formatSalaryRange(jobDoc || json),
      relativePostedAge(json.datePosted || json.createdAt),
    ]
      .filter(Boolean)
      .join(' · '),
    studentAction: action
      ? {
          status: action.status,
          statusLabel: APPLICATION_STATUS_LABELS[action.status] || action.status,
          appliedAt: action.appliedAt,
          droppedAt: action.droppedAt,
          resumeFixedAt: action.resumeFixedAt,
          atsResumeUrl: action.atsResumeUrl || '',
        }
      : null,
  };
}

export async function findJobsForStudent({
  companyId,
  studentPhone,
  studentRole,
  page = 0,
  limit = 20,
  q = '',
  scrapedFrom,
  scrapedTo,
  source = '',
  remote,
  minExp,
  maxExp,
  sponsored,
}) {
  const dropped = await StudentJobAction.find({
    companyId,
    studentPhone,
    status: 'dropped',
  }).select('scrapedJobId');
  const droppedIds = dropped.map((d) => d.scrapedJobId);

  const filter = {
    companyId,
    status: 'open',
    _id: { $nin: droppedIds },
  };

  if (source) filter.source = source;
  if (remote === true || remote === 'true') filter.remote = true;
  if (remote === false || remote === 'false') filter.remote = false;

  if (scrapedFrom || scrapedTo) {
    filter.createdAt = {};
    if (scrapedFrom) filter.createdAt.$gte = new Date(`${scrapedFrom}T00:00:00.000Z`);
    if (scrapedTo) filter.createdAt.$lte = new Date(`${scrapedTo}T23:59:59.999Z`);
  }

  const andClauses = [];

  const filterMin = parseExperienceFilter(minExp);
  const filterMax = parseExperienceFilter(maxExp);
  if (filterMin != null || filterMax != null) {
    await backfillMissingExperienceYears(companyId);
    // Overlap between job experience band and requested [minExp, maxExp].
    // Jobs with unknown experience are excluded when this filter is used.
    andClauses.push({
      $or: [{ minExperienceYears: { $ne: null } }, { maxExperienceYears: { $ne: null } }],
    });
    if (filterMin != null) {
      andClauses.push({
        $or: [
          { maxExperienceYears: { $gte: filterMin } },
          { maxExperienceYears: null, minExperienceYears: { $gte: filterMin } },
        ],
      });
    }
    if (filterMax != null) {
      andClauses.push({
        $or: [
          { minExperienceYears: { $lte: filterMax } },
          { minExperienceYears: null, maxExperienceYears: { $lte: filterMax } },
        ],
      });
    }
  }

  if (sponsored === true || sponsored === 'true') {
    andClauses.push({
      $or: [
        { description: { $regex: SPONSORSHIP_MONGO_REGEX } },
        { notes: { $regex: SPONSORSHIP_MONGO_REGEX } },
      ],
    });
  } else if (sponsored === false || sponsored === 'false') {
    andClauses.push({
      $nor: [
        { description: { $regex: SPONSORSHIP_MONGO_REGEX } },
        { notes: { $regex: SPONSORSHIP_MONGO_REGEX } },
      ],
    });
  }

  const keywords = studentRoleKeywords({ role: studentRole });
  const hasQuery = !!q.trim();

  // When searching freely, skip role matching so recruiters can find any open job
  if (!hasQuery && keywords.length) {
    andClauses.push({
      $or: keywords.map((kw) => ({
        jobTitle: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      })),
    });
  }

  if (hasQuery) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    andClauses.push({
      $or: [
        { jobTitle: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
        { location: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { technologySlugs: { $elemMatch: { $regex: escaped, $options: 'i' } } },
      ],
    });
  }

  if (andClauses.length) {
    filter.$and = andClauses;
  }

  const [items, total] = await Promise.all([
    ScrapedJob.find(filter)
      .sort({ datePosted: -1, createdAt: -1 })
      .skip(page * limit)
      .limit(limit),
    ScrapedJob.countDocuments(filter),
  ]);

  const actions = await StudentJobAction.find({
    companyId,
    studentPhone,
    scrapedJobId: { $in: items.map((j) => j._id) },
  });
  const actionMap = new Map(actions.map((a) => [a.scrapedJobId.toString(), a]));

  const jobs = items.map((doc) => {
    const json = scrapedJobToJSON(doc);
    const action = actionMap.get(json.id);
    return enrichJobForRecruiter(json, doc, action);
  });

  return { jobs, total, page, limit };
}

function parseExperienceFilter(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(50, Math.round(n));
}

/** Fill min/max experience on open jobs that are still missing both fields. */
async function backfillMissingExperienceYears(companyId) {
  const jobs = await ScrapedJob.find({
    companyId,
    status: 'open',
    minExperienceYears: null,
    maxExperienceYears: null,
  })
    .select('jobTitle description seniority raw minExperienceYears maxExperienceYears')
    .limit(500);

  for (const job of jobs) {
    const derived = extractExperienceYears({
      ...(job.raw && typeof job.raw === 'object' ? job.raw : {}),
      seniority: job.seniority,
      jobTitle: job.jobTitle,
      description: job.description,
    });
    if (derived.minExperienceYears == null && derived.maxExperienceYears == null) continue;
    job.minExperienceYears = derived.minExperienceYears;
    job.maxExperienceYears = derived.maxExperienceYears;
    await job.save();
  }
}

export async function getStudentActivityCounts(companyId, studentPhone) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 6);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const startOfMonth = new Date(now);
  startOfMonth.setUTCDate(startOfMonth.getUTCDate() - 29);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const base = {
    companyId,
    studentPhone,
    status: { $in: ['applied', 'interview_scheduled', 'interview_completed', 'offer_received', 'hired'] },
  };

  const [today, week, month] = await Promise.all([
    StudentJobAction.countDocuments({ ...base, appliedAt: { $gte: startOfToday } }),
    StudentJobAction.countDocuments({ ...base, appliedAt: { $gte: startOfWeek } }),
    StudentJobAction.countDocuments({ ...base, appliedAt: { $gte: startOfMonth } }),
  ]);

  return { today, week, month };
}

export async function loadRecruiterStudentDetail(company, phone) {
  let details = null;
  try {
    details = await fetchStudentDetails(phone);
  } catch {
    details = { phone };
  }

  const note = await StudentNote.findOne({ companyId: company._id, studentPhone: phone });
  const [payments, subscription, tickets] = await Promise.all([
    PaymentRecord.find({ companyId: company._id, studentPhone: phone })
      .sort({ createdAt: -1 })
      .limit(10),
    SubscriptionSchedule.findOne({ companyId: company._id, studentPhone: phone, status: 'active' }),
    Ticket.find({ companyId: company._id, studentPhone: phone, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('ticketNumber candidateName currentStage createdAt studentPhone'),
  ]);

  const activity = await getStudentActivityCounts(company._id, phone);

  return {
    phone,
    details: details || {},
    notes: note?.notes || '',
    companyId: company._id.toString(),
    companyLabel: company.name,
    subscription,
    payments,
    tickets: tickets.map((t) => ({
      id: t._id.toString(),
      ticketNumber: t.ticketNumber,
      candidateName: t.candidateName,
      currentStage: t.currentStage,
      createdAt: t.createdAt,
    })),
    activity,
  };
}

/**
 * Resume form filled by the student (ticket form) — for recruiter apply copy-paste panel.
 */
export async function getStudentResumeFormForRecruiter(recruiter, company, studentPhone) {
  await assertStudentAssignedToRecruiter(recruiter, company, studentPhone);

  const phone = String(studentPhone || '').trim();
  const phoneNormalized = normalizePhone(phone);
  const student = await Student.findOne({
    companyId: company._id,
    $or: [{ phone }, { phoneNormalized }],
  }).select('_id name email phone');

  const ticketQuery = {
    companyId: company._id,
    isDeleted: { $ne: true },
    resumeFormData: { $ne: null },
    $or: [{ studentPhone: phone }, { phone }],
  };
  if (student?._id) {
    ticketQuery.$or.push({ studentId: student._id });
  }

  const ticket = await Ticket.findOne(ticketQuery).sort({
    updatedAt: -1,
    createdAt: -1,
  });

  if (!ticket?.resumeFormData) {
    return {
      hasForm: false,
      studentPhone: phone,
      studentName: student?.name || '',
      studentEmail: student?.email || '',
      ticket: null,
      rows: [],
      fields: [],
      formData: null,
      message: 'No resume form has been filled for this student yet',
    };
  }

  const formData = normalizeResumeFormData(ticket.resumeFormData);
  const rows = formDataToRowsForStaff(formData, { revealSecrets: true });
  const fields = formDataToCopyFields(formData);

  return {
    hasForm: true,
    studentPhone: phone,
    studentName: student?.name || ticket.candidateName || '',
    studentEmail: student?.email || formData.resumeEmail || ticket.email || '',
    ticket: {
      id: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      candidateName: ticket.candidateName,
      resumeFormStatus: ticket.resumeFormData
        ? computeFormStatus(ticket.resumeFormData)
        : ticket.resumeFormStatus,
      updatedAt: ticket.updatedAt,
    },
    /** Label/value pairs for a simple list UI */
    rows: rows.map(([label, value]) => ({ label, value: String(value) })),
    /** Flat copy-friendly fields (includes email password for apply forms) */
    fields,
    formData,
  };
}

export async function recordJobAction({
  companyId,
  recruiterUsername,
  studentPhone,
  scrapedJobId,
  status,
}) {
  if (!isValidApplicationStatus(status)) {
    const err = new Error(`Invalid status: ${status}`);
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const existing = await StudentJobAction.findOne({ companyId, studentPhone, scrapedJobId });

  const update = {
    companyId,
    recruiterUsername,
    studentPhone,
    scrapedJobId,
    status,
    statusUpdatedAt: now,
  };

  if (status === 'dropped') {
    update.droppedAt = now;
  } else if (status === 'applied' || (!existing?.appliedAt && status !== 'saved')) {
    // First move into the pipeline sets appliedAt; keep existing appliedAt on later updates
    update.appliedAt = existing?.appliedAt || now;
    if (status !== 'dropped') update.droppedAt = null;
  }

  if (status !== 'dropped' && existing?.droppedAt) {
    update.droppedAt = null;
  }

  return StudentJobAction.findOneAndUpdate(
    { companyId, studentPhone, scrapedJobId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function mapJobSourceLabel(source) {
  if (source === 'theirstack') return 'Internal Scraper';
  if (source === 'manual') return 'Manual';
  return source || 'Internal Scraper';
}

function formatSalaryRange(job) {
  const min = job.salaryMinUsd;
  const max = job.salaryMaxUsd;
  if (min == null && max == null) return '';
  const fmt = (n) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `from ${fmt(min)}`;
  return `up to ${fmt(max)}`;
}

export function applicationToJSON(action, job, studentName = '') {
  const jobJson = job ? scrapedJobToJSON(job) : null;
  return {
    id: action._id.toString(),
    status: action.status,
    statusLabel: APPLICATION_STATUS_LABELS[action.status] || action.status,
    studentPhone: action.studentPhone,
    studentName: studentName || action.studentPhone,
    companyName: jobJson?.companyName || '',
    jobTitle: jobJson?.jobTitle || '',
    jobId: jobJson?.id || (action.scrapedJobId?._id || action.scrapedJobId)?.toString?.() || '',
    source: mapJobSourceLabel(jobJson?.source),
    sourceRaw: jobJson?.source || '',
    location: jobJson?.location || '',
    remote: !!jobJson?.remote,
    hybrid: !!jobJson?.hybrid,
    salaryRange: jobJson ? formatSalaryRange(job) : '',
    appliedAt: action.appliedAt,
    droppedAt: action.droppedAt,
    statusUpdatedAt: action.statusUpdatedAt || action.updatedAt,
    resumeFixedAt: action.resumeFixedAt,
    atsResumeUrl: action.atsResumeUrl || '',
    notes: action.notes || '',
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    job: jobJson,
  };
}

export async function listRecruiterApplications(
  recruiter,
  company,
  { status = '', studentPhone = '', q = '', page = 0, limit = 50 } = {}
) {
  const filter = {
    companyId: company._id,
    recruiterUsername: recruiter.username,
  };

  if (status) {
    if (!isValidApplicationStatus(status)) {
      const err = new Error(`Invalid status: ${status}`);
      err.status = 400;
      throw err;
    }
    filter.status = status;
  } else {
    filter.status = { $in: APPLICATION_TRACKER_STATUSES };
  }

  if (studentPhone) {
    filter.studentPhone = String(studentPhone).trim();
  }

  const skip = Math.max(page, 0) * Math.min(Math.max(limit, 1), 100);
  const take = Math.min(Math.max(limit, 1), 100);

  const [actions, total] = await Promise.all([
    StudentJobAction.find(filter)
      .sort({ appliedAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(take)
      .populate('scrapedJobId'),
    StudentJobAction.countDocuments(filter),
  ]);

  const assigned = await listRecruiterStudents(recruiter, company);
  const nameByPhone = new Map(assigned.map((s) => [s.phone, s.name]));

  let applications = actions.map((action) => {
    const job = action.scrapedJobId?.jobTitle ? action.scrapedJobId : null;
    return applicationToJSON(action, job, nameByPhone.get(action.studentPhone) || '');
  });

  const query = q.trim().toLowerCase();
  if (query) {
    applications = applications.filter(
      (a) =>
        a.studentName.toLowerCase().includes(query) ||
        a.companyName.toLowerCase().includes(query) ||
        a.jobTitle.toLowerCase().includes(query) ||
        a.studentPhone.includes(query)
    );
  }

  return {
    applications,
    total: query ? applications.length : total,
    page,
    limit: take,
    statuses: APPLICATION_TRACKER_STATUSES.map((s) => ({
      value: s,
      label: APPLICATION_STATUS_LABELS[s],
    })),
  };
}

export async function getRecruiterApplication(recruiter, company, applicationId) {
  const action = await StudentJobAction.findOne({
    _id: applicationId,
    companyId: company._id,
    recruiterUsername: recruiter.username,
  }).populate('scrapedJobId');

  if (!action) {
    const err = new Error('Application not found');
    err.status = 404;
    throw err;
  }

  const assigned = await listRecruiterStudents(recruiter, company);
  const student = assigned.find((s) => s.phone === action.studentPhone);
  const job = action.scrapedJobId?.jobTitle ? action.scrapedJobId : null;

  return {
    application: applicationToJSON(action, job, student?.name || ''),
    student: student || null,
  };
}

export async function updateRecruiterApplicationStatus(
  recruiter,
  company,
  applicationId,
  status,
  notes
) {
  if (!isValidApplicationStatus(status)) {
    const err = new Error(`Invalid status: ${status}`);
    err.status = 400;
    throw err;
  }

  const action = await StudentJobAction.findOne({
    _id: applicationId,
    companyId: company._id,
    recruiterUsername: recruiter.username,
  });

  if (!action) {
    const err = new Error('Application not found');
    err.status = 404;
    throw err;
  }

  const updated = await recordJobAction({
    companyId: company._id,
    recruiterUsername: recruiter.username,
    studentPhone: action.studentPhone,
    scrapedJobId: action.scrapedJobId,
    status,
  });

  if (notes !== undefined) {
    updated.notes = notes;
    await updated.save();
  }

  const job = await ScrapedJob.findById(updated.scrapedJobId);
  const assigned = await listRecruiterStudents(recruiter, company);
  const student = assigned.find((s) => s.phone === updated.studentPhone);

  return applicationToJSON(updated, job, student?.name || '');
}

export async function assertStudentAssignedToRecruiter(recruiter, company, studentPhone) {
  const assigned = await listRecruiterStudents(recruiter, company);
  const student = assigned.find((s) => s.phone === studentPhone);
  if (!student) {
    const err = new Error('Student not assigned to this recruiter');
    err.status = 403;
    throw err;
  }
  return student;
}

export async function getRecruiterScrapedJob(companyId, jobId) {
  const job = await ScrapedJob.findOne({ _id: jobId, companyId });
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  return job;
}

function extractResumeFromStudentDetails(details) {
  if (!details || typeof details !== 'object') return null;
  if (details.resume && typeof details.resume === 'object') return details.resume;
  if (details.jobtitle || details.experience || details.education) return details;
  return null;
}

export async function fixResumeForStudentJob({
  company,
  recruiter,
  studentPhone,
  scrapedJobId,
  improvements = [],
}) {
  const student = await assertStudentAssignedToRecruiter(recruiter, company, studentPhone);
  const job = await getRecruiterScrapedJob(company._id, scrapedJobId);

  const details = await fetchStudentDetails(studentPhone);
  const resumeData = extractResumeFromStudentDetails(details);
  if (!resumeData) {
    throw new Error('Student resume data not found');
  }

  const instructions = await getPromptByKey('resume_fix_for_job');
  const originalJobTitle = String(resumeData.jobtitle || resumeData.jobTitle || '').trim();
  const { resume: fixedResume, source, mock } = await fixResumeForJob(
    resumeData,
    {
      jobTitle: job.jobTitle,
      jobDescription: job.description,
      companyName: job.companyName,
      improvements,
    },
    instructions
  );

  // Keep the student's stored resume target title; only tailor content for the job.
  // Job-specific title is applied at ATS download time via options.jobtitle.
  if (fixedResume && typeof fixedResume === 'object') {
    if (originalJobTitle) {
      fixedResume.jobtitle = originalJobTitle;
      delete fixedResume.jobTitle;
    } else {
      delete fixedResume.jobtitle;
      delete fixedResume.jobTitle;
    }
  }

  const updateResult = await updateStudentResume(studentPhone, fixedResume);
  const now = new Date();

  const action = await StudentJobAction.findOneAndUpdate(
    {
      companyId: company._id,
      studentPhone,
      scrapedJobId: job._id,
    },
    {
      companyId: company._id,
      recruiterUsername: recruiter.username,
      studentPhone,
      scrapedJobId: job._id,
      resumeFixedAt: now,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const libraryEntry = await upsertResumeLibraryEntry({
    companyId: company._id,
    recruiterUsername: recruiter.username,
    studentPhone,
    studentName: student.name || '',
    scrapedJobId: job._id,
    jobTitle: job.jobTitle,
    companyName: job.companyName,
    resumeData: fixedResume,
    downloadUrl: '',
    source: 'fix_resume',
    jobDescription: job.description,
  });

  return {
    success: true,
    resume: fixedResume,
    source,
    mock: !!mock,
    updateResult,
    libraryEntry: resumeLibraryToJSON(libraryEntry),
    action: {
      resumeFixedAt: action.resumeFixedAt,
      status: action.status,
    },
  };
}

export async function downloadAtsResumeForStudentJob({
  company,
  recruiter,
  studentPhone,
  scrapedJobId,
  templateId,
  publicBaseUrl,
}) {
  const student = await assertStudentAssignedToRecruiter(recruiter, company, studentPhone);
  const job = await getRecruiterScrapedJob(company._id, scrapedJobId);

  let resolvedTemplateId = templateId;
  if (!resolvedTemplateId) {
    const defaultTemplate = await ResumeTemplate.findOne({
      companyId: company._id,
      isDefault: true,
    });
    if (defaultTemplate) resolvedTemplateId = defaultTemplate._id.toString();
  }

  const result = await buildResumeDownload(studentPhone, {
    templateId: resolvedTemplateId,
    companyId: company._id,
    publicBaseUrl,
    jobtitle: job.jobTitle,
    jobdescription: job.description,
    companyname: job.companyName,
    scrapedJobId: job._id.toString(),
  });

  const downloadUrl =
    result?.downloadUrl ||
    result?.data?.downloadUrl ||
    result?.url ||
    '';

  if (downloadUrl) {
    await StudentJobAction.findOneAndUpdate(
      {
        companyId: company._id,
        studentPhone,
        scrapedJobId: job._id,
      },
      {
        companyId: company._id,
        recruiterUsername: recruiter.username,
        studentPhone,
        scrapedJobId: job._id,
        atsResumeUrl: downloadUrl,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const details = await fetchStudentDetails(studentPhone).catch(() => null);
  const libraryEntry = await upsertResumeLibraryEntry({
    companyId: company._id,
    recruiterUsername: recruiter.username,
    studentPhone,
    studentName: student.name || '',
    scrapedJobId: job._id,
    jobTitle: job.jobTitle,
    companyName: job.companyName,
    resumeData: extractResumeFromStudentDetails(details),
    downloadUrl,
    source: 'ats_download',
    jobDescription: job.description,
  });

  return {
    success: true,
    downloadUrl,
    result,
    libraryEntry: resumeLibraryToJSON(libraryEntry),
    mock: !!result?.mock,
  };
}

export async function downloadStudentResume(
  company,
  recruiter,
  studentPhone,
  templateId,
  publicBaseUrl
) {
  await assertStudentAssignedToRecruiter(recruiter, company, studentPhone);

  let resolvedTemplateId = templateId;
  if (!resolvedTemplateId) {
    const defaultTemplate = await ResumeTemplate.findOne({
      companyId: company._id,
      isDefault: true,
    });
    if (defaultTemplate) resolvedTemplateId = defaultTemplate._id.toString();
  }

  const result = await buildResumeDownload(studentPhone, {
    templateId: resolvedTemplateId,
    companyId: company._id,
    publicBaseUrl,
  });

  const downloadUrl =
    result?.downloadUrl ||
    result?.data?.downloadUrl ||
    result?.url ||
    '';

  return { success: true, downloadUrl, result, mock: !!result?.mock };
}

export async function listRecruiterResumeTemplates(companyId) {
  const items = await ResumeTemplate.find({ companyId }).sort({ name: 1 });
  return items.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    isDefault: doc.isDefault,
  }));
}

function estimateAtsScore(resumeData, jobTitle = '', jobDescription = '') {
  const resumeText = JSON.stringify(resumeData || {}).toLowerCase();
  const jobText = `${jobTitle} ${jobDescription}`.toLowerCase();
  const words = jobText
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3);
  const unique = [...new Set(words)].slice(0, 40);
  if (!unique.length) return 75;
  const hits = unique.filter((w) => resumeText.includes(w)).length;
  const score = Math.round(55 + (hits / unique.length) * 40);
  return Math.min(98, Math.max(60, score));
}

export function resumeLibraryToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const atsScore = o.atsScore == null ? null : Number(o.atsScore);
  const improvements = Array.isArray(o.atsImprovements)
    ? o.atsImprovements.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return {
    id: o._id.toString(),
    studentPhone: o.studentPhone,
    studentName: o.studentName || '',
    jobId: o.scrapedJobId?.toString?.() || o.scrapedJobId || null,
    jobTitle: o.jobTitle || '',
    companyName: o.companyName || '',
    downloadUrl: o.downloadUrl || '',
    atsScore,
    atsSummary: o.atsSummary || '',
    atsImprovements: improvements,
    atsMeetsTarget:
      typeof o.atsMeetsTarget === 'boolean'
        ? o.atsMeetsTarget
        : atsScore != null
          ? atsScore >= ATS_TARGET_SCORE
          : false,
    atsTargetScore: ATS_TARGET_SCORE,
    atsScoredAt: o.atsScoredAt || null,
    source: o.source,
    notes: o.notes || '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    hasResumeData: !!o.resumeData,
  };
}

export async function upsertResumeLibraryEntry({
  companyId,
  recruiterUsername,
  studentPhone,
  studentName,
  scrapedJobId,
  jobTitle,
  companyName,
  resumeData,
  downloadUrl = '',
  source = 'fix_resume',
  jobDescription = '',
}) {
  let atsScore = null;
  let atsSummary = '';
  let atsImprovements = [];
  let atsMeetsTarget = false;
  let atsScoredAt = null;

  try {
    const scored = await scoreResumeAtsWithGemini(resumeData, {
      jobTitle,
      jobDescription,
      companyName,
    });
    atsScore = scored.atsScore;
    atsSummary = scored.summary || '';
    atsImprovements = scored.improvements || [];
    atsMeetsTarget = !!scored.meetsTarget;
    atsScoredAt = new Date();
  } catch (err) {
    console.warn('Gemini ATS scoring failed, falling back to keyword estimate:', err.message);
    atsScore = estimateAtsScore(resumeData, jobTitle, jobDescription);
    atsSummary = 'ATS score estimated locally after Gemini scoring failed.';
    atsImprovements = [
      'Re-run Fix Resume / Refresh to regenerate a Gemini ATS review.',
      'Align skills and summary with the job description keywords.',
    ];
    atsMeetsTarget = atsScore >= ATS_TARGET_SCORE;
    atsScoredAt = new Date();
  }

  const filter = {
    companyId,
    recruiterUsername,
    studentPhone,
    scrapedJobId: scrapedJobId || null,
  };

  return RecruiterResumeLibrary.findOneAndUpdate(
    filter,
    {
      $set: {
        studentName: studentName || '',
        jobTitle: jobTitle || '',
        companyName: companyName || '',
        resumeData: resumeData || null,
        downloadUrl: downloadUrl || '',
        atsScore,
        atsSummary,
        atsImprovements,
        atsMeetsTarget,
        atsScoredAt,
        source,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function listResumeLibrary(
  recruiter,
  company,
  { q = '', studentPhone = '', page = 0, limit = 50 } = {}
) {
  const filter = {
    companyId: company._id,
    recruiterUsername: recruiter.username,
  };
  if (studentPhone) filter.studentPhone = studentPhone;

  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(page, 0) * take;

  let [items, total] = await Promise.all([
    RecruiterResumeLibrary.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take),
    RecruiterResumeLibrary.countDocuments(filter),
  ]);

  const query = q.trim().toLowerCase();
  let resumes = items.map(resumeLibraryToJSON);
  if (query) {
    resumes = resumes.filter(
      (r) =>
        r.studentName.toLowerCase().includes(query) ||
        r.jobTitle.toLowerCase().includes(query) ||
        r.companyName.toLowerCase().includes(query) ||
        r.studentPhone.includes(query)
    );
    total = resumes.length;
  }

  return { resumes, total, page, limit: take };
}

export async function getResumeLibraryEntry(recruiter, company, id) {
  const item = await RecruiterResumeLibrary.findOne({
    _id: id,
    companyId: company._id,
    recruiterUsername: recruiter.username,
  });
  if (!item) {
    const err = new Error('Resume not found');
    err.status = 404;
    throw err;
  }
  return {
    resume: {
      ...resumeLibraryToJSON(item),
      resumeData: item.resumeData,
    },
  };
}

export async function refreshResumeLibraryEntry(recruiter, company, id) {
  const item = await RecruiterResumeLibrary.findOne({
    _id: id,
    companyId: company._id,
    recruiterUsername: recruiter.username,
  });
  if (!item) {
    const err = new Error('Resume not found');
    err.status = 404;
    throw err;
  }
  if (!item.scrapedJobId) {
    const err = new Error('Cannot refresh: no linked job');
    err.status = 400;
    throw err;
  }

  const result = await fixResumeForStudentJob({
    company,
    recruiter,
    studentPhone: item.studentPhone,
    scrapedJobId: item.scrapedJobId,
    improvements: Array.isArray(item.atsImprovements) ? item.atsImprovements : [],
  });

  return result.libraryEntry;
}

export async function deleteResumeLibraryEntry(recruiter, company, id) {
  const item = await RecruiterResumeLibrary.findOne({
    _id: id,
    companyId: company._id,
    recruiterUsername: recruiter.username,
  });
  if (!item) {
    const err = new Error('Resume not found');
    err.status = 404;
    throw err;
  }
  await item.deleteOne();
  return { success: true };
}

export async function getRecruiterDashboard(recruiter, company, { range = '7d' } = {}) {
  const students = await listRecruiterStudents(recruiter, company);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfPrevWeek = new Date(startOfWeek);
  startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const appliedStatuses = [
    'applied',
    'interview_scheduled',
    'interview_completed',
    'offer_received',
    'hired',
  ];

  const baseApp = {
    companyId: company._id,
    recruiterUsername: recruiter.username,
    status: { $in: appliedStatuses },
  };

  const [
    appsToday,
    appsYesterday,
    appsThisWeek,
    appsPrevWeek,
    interviewsScheduled,
    resumeGenerations,
    recentApps,
    recentResumes,
  ] = await Promise.all([
    StudentJobAction.countDocuments({ ...baseApp, appliedAt: { $gte: startOfToday } }),
    StudentJobAction.countDocuments({
      ...baseApp,
      appliedAt: { $gte: startOfYesterday, $lt: startOfToday },
    }),
    StudentJobAction.countDocuments({ ...baseApp, appliedAt: { $gte: startOfWeek } }),
    StudentJobAction.countDocuments({
      ...baseApp,
      appliedAt: { $gte: startOfPrevWeek, $lt: startOfWeek },
    }),
    StudentJobAction.countDocuments({
      companyId: company._id,
      recruiterUsername: recruiter.username,
      status: 'interview_scheduled',
    }),
    RecruiterResumeLibrary.countDocuments({
      companyId: company._id,
      recruiterUsername: recruiter.username,
    }),
    StudentJobAction.find({
      companyId: company._id,
      recruiterUsername: recruiter.username,
      status: { $ne: 'dropped' },
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('scrapedJobId'),
    RecruiterResumeLibrary.find({
      companyId: company._id,
      recruiterUsername: recruiter.username,
    })
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const studentsThisMonth = students.filter((s) => {
    const created = s.raw?.createdAt ? new Date(s.raw.createdAt) : null;
    return created && created >= startOfMonth;
  }).length;

  const wow =
    appsPrevWeek === 0
      ? appsThisWeek > 0
        ? 100
        : 0
      : Math.round(((appsThisWeek - appsPrevWeek) / appsPrevWeek) * 100);

  const nameByPhone = new Map(students.map((s) => [s.phone, s.name]));
  const activity = [];

  for (const r of recentResumes) {
    activity.push({
      type: 'resume_generated',
      text: `Generated resume for ${r.studentName || r.studentPhone} — ${r.companyName} (${r.jobTitle})`,
      at: r.createdAt,
    });
  }
  for (const a of recentApps) {
    const job = a.scrapedJobId?.jobTitle ? a.scrapedJobId : null;
    const name = nameByPhone.get(a.studentPhone) || a.studentPhone;
    if (a.status === 'applied') {
      activity.push({
        type: 'application_submitted',
        text: `Application submitted: ${name} → ${job?.companyName || 'company'}`,
        at: a.appliedAt || a.updatedAt,
      });
    } else if (a.status === 'interview_scheduled') {
      activity.push({
        type: 'interview_scheduled',
        text: `Interview scheduled for ${name} with ${job?.companyName || 'company'}`,
        at: a.statusUpdatedAt || a.updatedAt,
      });
    }
  }

  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
  const trendStart = new Date(startOfToday);
  trendStart.setDate(trendStart.getDate() - (days - 1));

  const trendApps = await StudentJobAction.find({
    ...baseApp,
    appliedAt: { $gte: trendStart },
  }).select('appliedAt');

  const byDay = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(trendStart);
    d.setDate(trendStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, 0);
  }
  for (const a of trendApps) {
    if (!a.appliedAt) continue;
    const key = new Date(a.appliedAt).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, byDay.get(key) + 1);
  }

  return {
    kpis: {
      assignedStudents: students.length,
      assignedStudentsDelta: studentsThisMonth,
      applicationsToday: appsToday,
      applicationsTodayDelta: appsToday - appsYesterday,
      applicationsThisWeek: appsThisWeek,
      applicationsWoWPercent: wow,
      interviewsScheduled,
      resumeGenerations,
    },
    trend: {
      range,
      points: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    },
    recentActivity: activity.slice(0, 12),
  };
}

export async function globalRecruiterSearch(recruiter, company, q = '') {
  const query = q.trim().toLowerCase();
  if (!query) return { students: [], jobs: [], applications: [] };

  const [students, apps] = await Promise.all([
    listRecruiterStudents(recruiter, company, { q: query }),
    listRecruiterApplications(recruiter, company, { q: query, limit: 20 }),
  ]);

  const jobFilter = {
    companyId: company._id,
    status: 'open',
    $or: [
      { jobTitle: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { companyName: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { location: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ],
  };
  const jobs = await ScrapedJob.find(jobFilter).sort({ createdAt: -1 }).limit(20);

  return {
    students: students.slice(0, 20),
    jobs: jobs.map((j) => enrichJobForRecruiter(scrapedJobToJSON(j), j)),
    applications: apps.applications.slice(0, 20),
  };
}

export async function getRecruiterAnalytics(recruiter, company) {
  const base = { companyId: company._id, recruiterUsername: recruiter.username };
  const byStatus = await StudentJobAction.aggregate([
    { $match: { ...base, status: { $ne: 'dropped' } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStudent = await StudentJobAction.aggregate([
    {
      $match: {
        ...base,
        status: {
          $in: ['applied', 'interview_scheduled', 'interview_completed', 'offer_received', 'hired'],
        },
      },
    },
    { $group: { _id: '$studentPhone', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const students = await listRecruiterStudents(recruiter, company);
  const nameByPhone = new Map(students.map((s) => [s.phone, s.name]));

  const resumeCount = await RecruiterResumeLibrary.countDocuments(base);
  const totalApps = byStatus.reduce((sum, s) => sum + s.count, 0);
  const hired = byStatus.find((s) => s._id === 'hired')?.count || 0;

  return {
    byStatus: byStatus.map((s) => ({
      status: s._id,
      label: APPLICATION_STATUS_LABELS[s._id] || s._id,
      count: s.count,
    })),
    topStudents: byStudent.map((s) => ({
      studentPhone: s._id,
      studentName: nameByPhone.get(s._id) || s._id,
      applications: s.count,
    })),
    totals: {
      applications: totalApps,
      resumes: resumeCount,
      hired,
      conversionRate: totalApps ? Math.round((hired / totalApps) * 1000) / 10 : 0,
    },
  };
}

export async function listRecruiterInterviews(recruiter, company, { status = '', q = '' } = {}) {
  const students = await listRecruiterStudents(recruiter, company);
  const phones = students.map((s) => s.phone).filter(Boolean);
  if (!phones.length) return { interviews: [], total: 0 };

  const filter = {
    companyId: company._id,
    isDeleted: { $ne: true },
    $or: [{ studentPhone: { $in: phones } }, { phone: { $in: phones } }],
  };
  if (status) filter.currentStage = status;

  let interviews = await Interview.find(filter).sort({ interviewDateTime: -1, createdAt: -1 }).limit(100);
  const query = q.trim().toLowerCase();
  if (query) {
    interviews = interviews.filter(
      (i) =>
        i.candidateName.toLowerCase().includes(query) ||
        (i.companyName || '').toLowerCase().includes(query) ||
        (i.position || '').toLowerCase().includes(query)
    );
  }

  return {
    interviews: interviews.map((i) => ({
      id: i._id.toString(),
      interviewNumber: i.interviewNumber,
      candidateName: i.candidateName,
      phone: i.phone || i.studentPhone,
      position: i.position,
      companyName: i.companyName,
      interviewDateTime: i.interviewDateTime,
      currentStage: i.currentStage,
      isCancelled: i.isCancelled,
      createdAt: i.createdAt,
    })),
    total: interviews.length,
  };
}

export async function updateRecruiterProfile(recruiter, { name, email, phone }) {
  if (name !== undefined) recruiter.name = String(name).trim();
  if (email !== undefined) recruiter.email = String(email).trim().toLowerCase();
  if (phone !== undefined) recruiter.phone = String(phone).trim();
  await recruiter.save();
  return recruiter.toSafeJSON();
}

export async function updateRecruiterPassword(recruiter, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    const err = new Error('currentPassword and newPassword are required');
    err.status = 400;
    throw err;
  }
  if (String(newPassword).length < 6) {
    const err = new Error('New password must be at least 6 characters');
    err.status = 400;
    throw err;
  }
  const valid = await bcrypt.compare(currentPassword, recruiter.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.status = 401;
    throw err;
  }
  recruiter.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await recruiter.save();
  return { success: true };
}

export async function listRecruiterNotifications(recruiter, company) {
  const dash = await getRecruiterDashboard(recruiter, company, { range: '7d' });
  const notifications = (dash.recentActivity || []).slice(0, 20).map((a, idx) => ({
    id: `act_${idx}_${new Date(a.at).getTime()}`,
    type: a.type,
    text: a.text,
    createdAt: a.at,
    read: false,
  }));
  return { notifications, unreadCount: notifications.length };
}
