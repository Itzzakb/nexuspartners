import bcrypt from 'bcryptjs';
import RecruiterAccount from '../models/RecruiterAccount.js';
import Company from '../models/Company.js';
import { signRecruiterAccessToken } from '../middleware/recruiterAuth.js';
import {
  listRecruiterStudents,
  loadRecruiterStudentDetail,
  findJobsForStudent,
  recordJobAction,
  getStudentActivityCounts,
  fixResumeForStudentJob,
  downloadAtsResumeForStudentJob,
  downloadStudentResume,
  listRecruiterResumeTemplates,
  listRecruiterApplications,
  getRecruiterApplication,
  updateRecruiterApplicationStatus,
  enrichJobForRecruiter,
  listResumeLibrary,
  getResumeLibraryEntry,
  refreshResumeLibraryEntry,
  deleteResumeLibraryEntry,
  getRecruiterDashboard,
  getRecruiterAnalytics,
  globalRecruiterSearch,
  listRecruiterInterviews,
  updateRecruiterProfile,
  updateRecruiterPassword,
  listRecruiterNotifications,
  getStudentResumeFormForRecruiter,
} from '../services/recruiterPortal.service.js';
import { APPLICATION_STATUS_LABELS, APPLICATION_TRACKER_STATUSES } from '../constants/recruiterApplications.js';
import ScrapedJob from '../models/ScrapedJob.js';
import StudentNote from '../models/StudentNote.js';
import StudentJobAction from '../models/StudentJobAction.js';
import { scrapedJobToJSON } from '../services/jobScrap.service.js';

export async function recruiterLogin(req, res) {
  try {
    const { username, password, companySlug } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let companyQuery = {};
    if (companySlug) {
      companyQuery = { slug: companySlug };
    } else {
      companyQuery = { isPlatformAdmin: true };
    }

    const company = await Company.findOne(companyQuery);
    if (!company) {
      return res.status(400).json({ error: 'Company not found' });
    }

    const recruiter = await RecruiterAccount.findOne({
      username: username.toLowerCase(),
      companyId: company._id,
    });

    if (!recruiter) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, recruiter.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!recruiter.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    recruiter.lastLoginAt = new Date();
    await recruiter.save();

    const accessToken = signRecruiterAccessToken(recruiter);

    return res.json({
      recruiter: recruiter.toSafeJSON(),
      company: {
        id: company._id.toString(),
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl,
        appTitle: company.appTitle,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
      },
      accessToken,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
}

export async function recruiterMe(req, res) {
  return res.json({
    recruiter: req.recruiter.toSafeJSON(),
    company: {
      id: req.company._id.toString(),
      name: req.company.name,
      slug: req.company.slug,
      logoUrl: req.company.logoUrl,
      appTitle: req.company.appTitle,
      primaryColor: req.company.primaryColor,
      secondaryColor: req.company.secondaryColor,
    },
  });
}

export async function listStudents(req, res) {
  try {
    const students = await listRecruiterStudents(req.recruiter, req.company, {
      q: req.query.q || '',
      subscriptionStatus: req.query.subscriptionStatus || '',
      sort: req.query.sort || 'name_asc',
    });
    return res.json({
      students,
      total: students.length,
      assignedCount: students.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to list students' });
  }
}

export async function getStudent(req, res) {
  try {
    const phone = req.params.phone;
    const assigned = await listRecruiterStudents(req.recruiter, req.company);
    const allowed = assigned.some((s) => s.phone === phone);
    if (!allowed) {
      return res.status(403).json({ error: 'Student not assigned to this recruiter' });
    }

    const student = await loadRecruiterStudentDetail(req.company, phone);
    const normalized = assigned.find((s) => s.phone === phone);
    return res.json({
      student: {
        ...student,
        name: normalized?.name || student.details?.name || phone,
        email: normalized?.email || student.details?.email || '',
        role: normalized?.role || '',
        location: normalized?.location || '',
        isActive: normalized?.isActive ?? true,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to get student' });
  }
}

export async function getStudentActivity(req, res) {
  try {
    const activity = await getStudentActivityCounts(req.company._id, req.params.phone);
    return res.json({ activity });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get activity' });
  }
}

export async function getStudentResumeForm(req, res) {
  try {
    const result = await getStudentResumeFormForRecruiter(
      req.recruiter,
      req.company,
      req.params.phone
    );
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to load resume form' });
  }
}

export async function updateStudentNotes(req, res) {
  try {
    const phone = req.params.phone;
    const { notes } = req.body;

    const note = await StudentNote.findOneAndUpdate(
      { companyId: req.company._id, studentPhone: phone },
      { notes: notes || '', updatedBy: null },
      { upsert: true, new: true }
    );

    return res.json({ notes: note.notes });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notes' });
  }
}

export async function listJobs(req, res) {
  try {
    const { studentPhone } = req.query;
    if (!studentPhone) {
      return res.status(400).json({ error: 'studentPhone is required' });
    }

    const assigned = await listRecruiterStudents(req.recruiter, req.company);
    const student = assigned.find((s) => s.phone === studentPhone);
    if (!student) {
      return res.status(403).json({ error: 'Student not assigned to this recruiter' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const result = await findJobsForStudent({
      companyId: req.company._id,
      studentPhone,
      studentRole: student.role,
      page,
      limit,
      q: req.query.q || '',
      scrapedFrom: req.query.scrapedFrom,
      scrapedTo: req.query.scrapedTo,
      source: req.query.source || '',
      remote: req.query.remote,
      minExp: req.query.minExp ?? req.query.experienceMin,
      maxExp: req.query.maxExp ?? req.query.experienceMax,
      sponsored: req.query.sponsored ?? req.query.isSponsored,
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to list jobs' });
  }
}

export async function getJob(req, res) {
  try {
    const { studentPhone } = req.query;
    if (!studentPhone) {
      return res.status(400).json({ error: 'studentPhone is required' });
    }

    const job = await ScrapedJob.findOne({
      _id: req.params.id,
      companyId: req.company._id,
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const student = await loadRecruiterStudentDetail(req.company, studentPhone);
    const action = await StudentJobAction.findOne({
      companyId: req.company._id,
      studentPhone,
      scrapedJobId: job._id,
    });

    return res.json({
      job: enrichJobForRecruiter(scrapedJobToJSON(job), job, action),
      applicant: student,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to get job' });
  }
}

export async function dropJob(req, res) {
  try {
    const { studentPhone } = req.body;
    if (!studentPhone) return res.status(400).json({ error: 'studentPhone is required' });

    const job = await ScrapedJob.findOne({
      _id: req.params.id,
      companyId: req.company._id,
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const action = await recordJobAction({
      companyId: req.company._id,
      recruiterUsername: req.recruiter.username,
      studentPhone,
      scrapedJobId: job._id,
      status: 'dropped',
    });

    return res.json({ success: true, action: { status: action.status, droppedAt: action.droppedAt } });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to drop job' });
  }
}

export async function applyJob(req, res) {
  try {
    const { studentPhone } = req.body;
    if (!studentPhone) return res.status(400).json({ error: 'studentPhone is required' });

    const job = await ScrapedJob.findOne({
      _id: req.params.id,
      companyId: req.company._id,
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const action = await recordJobAction({
      companyId: req.company._id,
      recruiterUsername: req.recruiter.username,
      studentPhone,
      scrapedJobId: job._id,
      status: 'applied',
    });

    const studentForm = await getStudentResumeFormForRecruiter(
      req.recruiter,
      req.company,
      studentPhone
    ).catch(() => null);

    return res.json({
      success: true,
      applyUrl: job.applyUrl || job.finalUrl || job.sourceUrl || '',
      job: {
        id: job._id.toString(),
        jobTitle: job.jobTitle,
        companyName: job.companyName,
      },
      action: {
        id: action._id.toString(),
        status: action.status,
        statusLabel: APPLICATION_STATUS_LABELS[action.status],
        appliedAt: action.appliedAt,
      },
      /** Student resume-form details for side-by-side copy/paste while applying */
      studentForm,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to apply' });
  }
}

export async function listApplications(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await listRecruiterApplications(req.recruiter, req.company, {
      status: req.query.status || '',
      studentPhone: req.query.studentPhone || '',
      q: req.query.q || '',
      page,
      limit,
    });
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to list applications' });
  }
}

export async function getApplication(req, res) {
  try {
    const result = await getRecruiterApplication(req.recruiter, req.company, req.params.id);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to get application' });
  }
}

export async function updateApplicationStatus(req, res) {
  try {
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const application = await updateRecruiterApplicationStatus(
      req.recruiter,
      req.company,
      req.params.id,
      status,
      notes
    );
    return res.json({ application });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to update application status' });
  }
}

export async function listApplicationStatuses(_req, res) {
  return res.json({
    statuses: APPLICATION_TRACKER_STATUSES.map((s) => ({
      value: s,
      label: APPLICATION_STATUS_LABELS[s],
    })),
  });
}

export async function listStudentTickets(req, res) {
  try {
    const student = await loadRecruiterStudentDetail(req.company, req.params.phone);
    return res.json({ tickets: student.tickets });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list tickets' });
  }
}

export async function listResumeTemplates(req, res) {
  try {
    const templates = await listRecruiterResumeTemplates(req.company._id);
    return res.json({ templates });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list resume templates' });
  }
}

function requestPublicBaseUrl(req) {
  if (process.env.SERVER_URL) return process.env.SERVER_URL.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

export async function downloadStudentResumeHandler(req, res) {
  try {
    const { templateId } = req.query;
    const result = await downloadStudentResume(
      req.company,
      req.recruiter,
      req.params.phone,
      templateId,
      requestPublicBaseUrl(req)
    );
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to download resume' });
  }
}

export async function fixResume(req, res) {
  try {
    const { studentPhone, improvements } = req.body;
    if (!studentPhone) return res.status(400).json({ error: 'studentPhone is required' });

    const result = await fixResumeForStudentJob({
      company: req.company,
      recruiter: req.recruiter,
      studentPhone,
      scrapedJobId: req.params.id,
      improvements: Array.isArray(improvements) ? improvements : [],
    });

    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to fix resume' });
  }
}

export async function downloadAtsResume(req, res) {
  try {
    const { studentPhone, templateId } = req.body;
    if (!studentPhone) return res.status(400).json({ error: 'studentPhone is required' });

    const result = await downloadAtsResumeForStudentJob({
      company: req.company,
      recruiter: req.recruiter,
      studentPhone,
      scrapedJobId: req.params.id,
      templateId,
      publicBaseUrl: requestPublicBaseUrl(req),
    });

    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to download ATS resume' });
  }
}

export async function listResumeLibraryHandler(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await listResumeLibrary(req.recruiter, req.company, {
      q: req.query.q || '',
      studentPhone: req.query.studentPhone || '',
      page,
      limit,
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to list resume library' });
  }
}

export async function getResumeLibraryHandler(req, res) {
  try {
    const result = await getResumeLibraryEntry(req.recruiter, req.company, req.params.id);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to get resume' });
  }
}

export async function refreshResumeLibraryHandler(req, res) {
  try {
    const resume = await refreshResumeLibraryEntry(req.recruiter, req.company, req.params.id);
    return res.json({ resume });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to refresh resume' });
  }
}

export async function deleteResumeLibraryHandler(req, res) {
  try {
    const result = await deleteResumeLibraryEntry(req.recruiter, req.company, req.params.id);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to delete resume' });
  }
}

export async function getDashboard(req, res) {
  try {
    const data = await getRecruiterDashboard(req.recruiter, req.company, {
      range: req.query.range || '7d',
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load dashboard' });
  }
}

export async function getAnalytics(req, res) {
  try {
    const data = await getRecruiterAnalytics(req.recruiter, req.company);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load analytics' });
  }
}

export async function searchAll(req, res) {
  try {
    const data = await globalRecruiterSearch(req.recruiter, req.company, req.query.q || '');
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
}

export async function listInterviews(req, res) {
  try {
    const data = await listRecruiterInterviews(req.recruiter, req.company, {
      status: req.query.status || '',
      q: req.query.q || '',
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to list interviews' });
  }
}

export async function updateSettings(req, res) {
  try {
    const recruiter = await updateRecruiterProfile(req.recruiter, req.body || {});
    return res.json({ recruiter });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to update settings' });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = await updateRecruiterPassword(req.recruiter, currentPassword, newPassword);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to change password' });
  }
}

export async function listNotifications(req, res) {
  try {
    const data = await listRecruiterNotifications(req.recruiter, req.company);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to list notifications' });
  }
}
