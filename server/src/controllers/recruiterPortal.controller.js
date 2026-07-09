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
} from '../services/recruiterPortal.service.js';
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
    });
    return res.json({ students, total: students.length });
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
      job: {
        ...scrapedJobToJSON(job),
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
      },
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

    return res.json({
      success: true,
      applyUrl: job.applyUrl || job.finalUrl || job.sourceUrl || '',
      action: { status: action.status, appliedAt: action.appliedAt },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to apply' });
  }
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

export async function downloadStudentResumeHandler(req, res) {
  try {
    const { templateId } = req.query;
    const result = await downloadStudentResume(
      req.company,
      req.recruiter,
      req.params.phone,
      templateId
    );
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to download resume' });
  }
}

export async function fixResume(req, res) {
  try {
    const { studentPhone } = req.body;
    if (!studentPhone) return res.status(400).json({ error: 'studentPhone is required' });

    const result = await fixResumeForStudentJob({
      company: req.company,
      recruiter: req.recruiter,
      studentPhone,
      scrapedJobId: req.params.id,
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
    });

    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to download ATS resume' });
  }
}
