import Company from '../models/Company.js';

const API_BASE =
  process.env.NEXUS_STUDENT_API_BASE ||
  process.env.FUTUREFLUX_API_BASE ||
  'https://api.futureflux.ai';

export function resolveApiCompanyName(company) {
  if (company.apiCompanyName) return company.apiCompanyName;
  if (company.name === 'nexuspartners.com') return 'nexuspartners';
  return company.slug;
}

export async function getApiCompanyNameById(companyId) {
  const company = await Company.findById(companyId);
  if (!company) throw new Error('Company not found');
  return resolveApiCompanyName(company);
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `API error ${res.status}`);
  }
  return data;
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `API error ${res.status}`);
  }
  return data;
}

export async function fetchStudents(companyName) {
  const data = await apiPost('/getstudents', { company: companyName });
  return data.students || [];
}

export async function fetchCompanyMembers(companyName) {
  const data = await apiPost('/getcompanymembers', { companyname: companyName });
  return data?.data?.clerks || data?.clerks || [];
}

export async function fetchRecruiterStudents(recruiterUsername) {
  const data = await apiPost('/getrecuritorstudents', { recruiterId: recruiterUsername });
  return data?.data?.students || data?.students || [];
}

export async function fetchStudentDetails(phone) {
  const data = await apiPost('/getstudentdetails', { studentid: phone });
  return data?.data?.studentdetails || data?.studentdetails || null;
}

export async function fetchJobRoles() {
  const data = await apiGet('/fetchjobroles');
  return data?.jobroles || [];
}

export async function createClerk(payload) {
  return apiPost('/createClerk', payload);
}

export async function editClerk(username, clerkData) {
  return apiPost('/editclerk', { username, data: clerkData });
}

export async function createStudent(payload) {
  try {
    return await apiPost('/createuser', payload);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return { success: true, mock: true, student: { phone: payload.mobile, name: payload.name } };
    }
    throw err;
  }
}

export async function updateStudentResume(phone, resumeData) {
  try {
    return await apiPost('/updateResume', { studentid: phone, resume: resumeData });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return { success: true, mock: true };
    }
    throw err;
  }
}

export async function buildResumeDownload(phone, options = {}) {
  try {
    return await apiPost('/buildResumedownload', { studentid: phone, ...options });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return { success: true, mock: true, downloadUrl: '' };
    }
    throw err;
  }
}
