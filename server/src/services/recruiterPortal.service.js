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
} from './nexusStudentApi.service.js';
import { scrapedJobToJSON } from './jobScrap.service.js';
import { fixResumeForJob } from './gemini.service.js';
import { getPromptByKey } from '../controllers/prompt.controller.js';
import ResumeTemplate from '../models/ResumeTemplate.js';

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
  const location = (raw.location || raw.city || raw.address || '').toString();
  const email = (raw.email || '').toString();
  const isActive =
    raw.isactive === true ||
    raw.isActive === true ||
    raw.active === true ||
    String(raw.status || '').toLowerCase() === 'active';

  return {
    phone,
    name,
    email,
    role,
    location,
    isActive,
    companyId,
    raw,
  };
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

export async function findJobsForStudent({
  companyId,
  studentPhone,
  studentRole,
  page = 0,
  limit = 20,
  q = '',
  scrapedFrom,
  scrapedTo,
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

  if (scrapedFrom || scrapedTo) {
    filter.createdAt = {};
    if (scrapedFrom) filter.createdAt.$gte = new Date(`${scrapedFrom}T00:00:00.000Z`);
    if (scrapedTo) filter.createdAt.$lte = new Date(`${scrapedTo}T23:59:59.999Z`);
  }

  const keywords = studentRoleKeywords({ role: studentRole });
  const clauses = [];

  if (keywords.length) {
    clauses.push({
      $or: keywords.map((kw) => ({
        jobTitle: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      })),
    });
  }

  if (q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clauses.push({
      $or: [
        { jobTitle: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
        { location: { $regex: escaped, $options: 'i' } },
      ],
    });
  }

  if (clauses.length) {
    filter.$and = clauses;
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
    return {
      ...json,
      verified: true,
      studentAction: action
        ? {
            status: action.status,
            appliedAt: action.appliedAt,
            droppedAt: action.droppedAt,
            resumeFixedAt: action.resumeFixedAt,
            atsResumeUrl: action.atsResumeUrl || '',
          }
        : null,
    };
  });

  return { jobs, total, page, limit };
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

  const base = { companyId, studentPhone, status: 'applied' };

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

export async function listRecruiterStudents(recruiter, company, { q = '' } = {}) {
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

  const normalized = students.map((s) => normalizeRecruiterStudent(s, company._id.toString()));
  const query = q.trim().toLowerCase();
  const filtered = query
    ? normalized.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.phone.includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.role.toLowerCase().includes(query)
      )
    : normalized;

  return filtered;
}

export async function recordJobAction({
  companyId,
  recruiterUsername,
  studentPhone,
  scrapedJobId,
  status,
}) {
  const now = new Date();
  const update = {
    companyId,
    recruiterUsername,
    studentPhone,
    scrapedJobId,
    status,
    appliedAt: status === 'applied' ? now : null,
    droppedAt: status === 'dropped' ? now : null,
  };

  return StudentJobAction.findOneAndUpdate(
    { companyId, studentPhone, scrapedJobId },
    update,
    { upsert: true, new: true }
  );
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
}) {
  await assertStudentAssignedToRecruiter(recruiter, company, studentPhone);
  const job = await getRecruiterScrapedJob(company._id, scrapedJobId);

  const details = await fetchStudentDetails(studentPhone);
  const resumeData = extractResumeFromStudentDetails(details);
  if (!resumeData) {
    throw new Error('Student resume data not found');
  }

  const instructions = await getPromptByKey('resume_fix_for_job');
  const { resume: fixedResume, source, mock } = await fixResumeForJob(
    resumeData,
    {
      jobTitle: job.jobTitle,
      jobDescription: job.description,
      companyName: job.companyName,
    },
    instructions
  );

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

  return {
    success: true,
    resume: fixedResume,
    source,
    mock: !!mock,
    updateResult,
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
}) {
  await assertStudentAssignedToRecruiter(recruiter, company, studentPhone);
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

  return {
    success: true,
    downloadUrl,
    result,
    mock: !!result?.mock,
  };
}

export async function downloadStudentResume(company, recruiter, studentPhone, templateId) {
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
