import Company from '../models/Company.js';
import {
  fetchStudents,
  fetchCompanyMembers,
  getCompanyMember,
  fetchStudentDetails,
  fetchJobRoles,
  createClerk,
  editClerk,
  resolveApiCompanyName,
} from '../services/nexusStudentApi.service.js';
import { upsertRecruiterAccount } from '../services/recruiterPortal.service.js';

async function resolveCompanyForRequest(user, queryCompanyId) {
  let companyId = user.companyId._id;
  if (user.isPlatformAdmin && queryCompanyId) companyId = queryCompanyId;
  const company = await Company.findById(companyId);
  if (!company) throw new Error('Company not found');
  return company;
}

function canManageRecruiters(user) {
  if (user.isPlatformAdmin || user.isCompanyAdmin) return true;
  const perms = user.modulePermissions || {};
  return !!perms.recruiters;
}

export async function proxyStudents(req, res) {
  try {
    const company = await resolveCompanyForRequest(req.user, req.body.companyId || req.query.companyId);
    const apiName = req.body.company || resolveApiCompanyName(company);
    const students = await fetchStudents(apiName);
    return res.json({ students });
  } catch (err) {
    console.error('Proxy students error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch students' });
  }
}

export async function proxyCompanyMembers(req, res) {
  try {
    const company = await resolveCompanyForRequest(req.user, req.body.companyId || req.query.companyId);
    const apiName = req.body.companyname || resolveApiCompanyName(company);
    const clerks = await fetchCompanyMembers(apiName);
    return res.json({ clerks });
  } catch (err) {
    console.error('Proxy members error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch recruiters' });
  }
}

export async function getRecruiter(req, res) {
  try {
    const username = req.params.username || req.body.username;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const company = await resolveCompanyForRequest(req.user, req.query.companyId || req.body.companyId);
    const clerk = await getCompanyMember(company._id, username);
    return res.json({ clerk });
  } catch (err) {
    const status = err.message === 'Recruiter not found' ? 404 : 500;
    return res.status(status).json({ error: err.message || 'Failed to fetch recruiter' });
  }
}

export async function proxyStudentDetails(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });
    const details = await fetchStudentDetails(phone);
    return res.json({ student: details });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch student' });
  }
}

export async function proxyJobRoles(_req, res) {
  try {
    const jobroles = await fetchJobRoles();
    return res.json({ jobroles });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch job roles' });
  }
}

export async function createRecruiter(req, res) {
  try {
    if (!canManageRecruiters(req.user)) {
      return res.status(403).json({ error: 'You do not have permission to create recruiters' });
    }

    const { name, mobile, email, username, password, companyId } = req.body;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'Name, email, username, and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const company = await resolveCompanyForRequest(req.user, companyId);
    const companyname = resolveApiCompanyName(company);

    const result = await createClerk({
      name,
      mobile: mobile || '',
      email,
      username,
      password,
      ssoPassword: password,
      role: 'clerk',
      company: companyname,
    });

    await upsertRecruiterAccount({
      username,
      password,
      name,
      email,
      phone: mobile || '',
      companyId: company._id,
    });

    return res.status(201).json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create recruiter' });
  }
}

export async function updateRecruiter(req, res) {
  try {
    if (!canManageRecruiters(req.user)) {
      return res.status(403).json({ error: 'You do not have permission to edit recruiters' });
    }

    const { username, data, companyId } = req.body;
    if (!username || !data) return res.status(400).json({ error: 'username and data required' });

    const company = await resolveCompanyForRequest(req.user, companyId);
    const result = await editClerk(username, data, company._id);
    return res.json({ success: true, result, clerk: result.clerk });
  } catch (err) {
    const status = err.message === 'Recruiter not found' ? 404 : 500;
    return res.status(status).json({ error: err.message || 'Failed to update recruiter' });
  }
}
