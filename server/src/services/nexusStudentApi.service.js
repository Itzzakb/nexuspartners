import bcrypt from 'bcryptjs';
import Company from '../models/Company.js';
import Student from '../models/Student.js';
import RecruiterAccount from '../models/RecruiterAccount.js';

export function normalizePhone(phone = '') {
  return String(phone).replace(/[^\d+]/g, '').trim();
}

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

function splitName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function toExternalStudentShape(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const name = o.name || `${o.firstName || ''} ${o.lastName || ''}`.trim() || 'Unknown';
  const { firstName, lastName } = o.firstName || o.lastName ? { firstName: o.firstName, lastName: o.lastName } : splitName(name);

  return {
    _id: o._id?.toString?.() ?? o._id,
    name,
    studentname: name,
    firstname: firstName,
    lastname: lastName,
    email: o.email || '',
    phone: o.phone || '',
    mobile: o.phone || '',
    studentid: o.phone || '',
    role: o.role || '',
    city: o.city || '',
    state: o.state || '',
    linkedin: o.linkedin || '',
    status: o.status || 'active',
    resume: o.resume || null,
    adtionaldetails: o.additionalDetails || [],
    additionalDetails: o.additionalDetails || [],
    recruiterId: o.recruiterUsername || '',
    joindate: o.joinDate || '',
    subscription_amount: o.subscriptionAmount || 0,
    subscription_date: o.subscriptionDate || null,
    subscription_days: o.subscriptionDays || 0,
    visa: o.visa || '',
    company: o.companyId?.name || o.companyId?.toString?.() || '',
    companyId: o.companyId?._id?.toString?.() ?? o.companyId?.toString?.() ?? o.companyId,
    isDemo: !!o.isDemo,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function resolveCompanyByNameOrId(companyNameOrId) {
  if (!companyNameOrId) return null;
  if (/^[a-f\d]{24}$/i.test(String(companyNameOrId))) {
    return Company.findById(companyNameOrId);
  }
  return Company.findOne({
    $or: [
      { apiCompanyName: companyNameOrId },
      { slug: companyNameOrId },
      { name: companyNameOrId },
    ],
  });
}

export async function fetchStudents(companyName) {
  const company = await resolveCompanyByNameOrId(companyName);
  if (!company) return [];

  const students = await Student.find({
    companyId: company._id,
    status: { $ne: 'suspended' },
  }).sort({ createdAt: -1 });

  return students.map(toExternalStudentShape);
}

export async function fetchCompanyMembers(companyName) {
  const company = await resolveCompanyByNameOrId(companyName);
  if (!company) return [];

  const recruiters = await RecruiterAccount.find({ companyId: company._id, isActive: true }).sort({
    name: 1,
  });

  return recruiters.map((r) => ({
    _id: r._id.toString(),
    name: r.name,
    mobile: r.phone || '',
    email: r.email || '',
    username: r.username,
  }));
}

export async function getCompanyMember(companyNameOrId, username) {
  const company = await resolveCompanyByNameOrId(companyNameOrId);
  if (!company) throw new Error('Company not found');

  const recruiter = await RecruiterAccount.findOne({
    companyId: company._id,
    username: String(username || '').toLowerCase().trim(),
  });
  if (!recruiter) throw new Error('Recruiter not found');

  return {
    _id: recruiter._id.toString(),
    name: recruiter.name,
    mobile: recruiter.phone || '',
    email: recruiter.email || '',
    username: recruiter.username,
    isActive: recruiter.isActive,
  };
}

export async function fetchRecruiterStudents(recruiterUsername) {
  const students = await Student.find({
    recruiterUsername: String(recruiterUsername || '').trim(),
    status: { $ne: 'suspended' },
  }).sort({ createdAt: -1 });

  return students.map(toExternalStudentShape);
}

export async function fetchStudentDetails(phone, companyId) {
  const normalized = normalizePhone(phone);
  const query = {
    $or: [{ phoneNormalized: normalized }, { phone: phone }],
  };
  if (companyId) query.companyId = companyId;
  const student = await Student.findOne(query);

  if (!student) return null;
  return toExternalStudentShape(student);
}

export async function fetchJobRoles() {
  return [
    'Data Engineer',
    'Cloud Data Engineer',
    'Java Developer',
    'Data Scientist',
    'Software Engineer',
    'Full Stack Developer',
    'Data Analyst',
    'Business Analyst',
    'Devops Engineer',
    'Frontend Developer',
    'Gen AI',
  ];
}

export async function createClerk(payload) {
  const company = await resolveCompanyByNameOrId(payload.company);
  if (!company) throw new Error('Company not found');

  const username = String(payload.username || '').toLowerCase().trim();
  if (!username) throw new Error('Username is required');
  if (!payload.password && !payload.ssoPassword) throw new Error('Password is required');

  const existing = await RecruiterAccount.findOne({
    companyId: company._id,
    username,
  });
  if (existing) throw new Error('Recruiter username already exists');

  const passwordHash = await bcrypt.hash(payload.password || payload.ssoPassword, 12);

  const recruiter = await RecruiterAccount.create({
    username,
    passwordHash,
    name: payload.name || username,
    email: payload.email || '',
    phone: payload.mobile || '',
    companyId: company._id,
    isActive: true,
  });

  return {
    success: true,
    clerk: {
      _id: recruiter._id.toString(),
      name: recruiter.name,
      email: recruiter.email,
      username: recruiter.username,
      mobile: recruiter.phone,
    },
  };
}

export async function editClerk(username, clerkData, companyId) {
  const query = { username: String(username).toLowerCase().trim() };
  if (companyId) query.companyId = companyId;

  const recruiter = await RecruiterAccount.findOne(query);
  if (!recruiter) throw new Error('Recruiter not found');

  if (clerkData.name !== undefined) recruiter.name = String(clerkData.name || '').trim() || recruiter.name;
  if (clerkData.email !== undefined) recruiter.email = String(clerkData.email || '').trim();
  if (clerkData.mobile !== undefined) recruiter.phone = String(clerkData.mobile || '').trim();

  const nextPassword = clerkData.password || clerkData.ssoPassword;
  if (nextPassword) {
    if (String(nextPassword).length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    recruiter.passwordHash = await bcrypt.hash(String(nextPassword), 10);
  }

  await recruiter.save();
  return {
    success: true,
    clerk: {
      _id: recruiter._id.toString(),
      name: recruiter.name,
      email: recruiter.email || '',
      username: recruiter.username,
      mobile: recruiter.phone || '',
    },
  };
}

export async function createStudent(payload) {
  const company = await resolveCompanyByNameOrId(payload.company || payload.companyId);
  if (!company) throw new Error('Company not found');

  const phone = String(payload.mobile || payload.phone || '').trim();
  if (!phone) throw new Error('Phone is required');

  const phoneNormalized = normalizePhone(phone);
  const existing = await Student.findOne({ companyId: company._id, phoneNormalized });
  if (existing) throw new Error('A student with this phone already exists for this company');

  const name =
    payload.name ||
    `${payload.firstname || payload.firstName || ''} ${payload.lastname || payload.lastName || ''}`.trim();
  if (!name) throw new Error('Name is required');

  const { firstName, lastName } = splitName(name);
  const student = await Student.create({
    companyId: company._id,
    name,
    firstName: payload.firstname || payload.firstName || firstName,
    lastName: payload.lastname || payload.lastName || lastName,
    email: payload.email || '',
    phone,
    phoneNormalized,
    role: payload.role || '',
    city: payload.city || '',
    state: payload.state || '',
    linkedin: payload.linkedin || '',
    status: payload.status || 'active',
    resume: payload.resume || null,
    additionalDetails: payload.adtionaldetails || payload.additionalDetails || [],
    recruiterUsername: payload.recruiterId || payload.recruiterUsername || '',
    joinDate: payload.joindate || new Date().toISOString().slice(0, 10),
    visa: payload.visa || '',
    createdBy: payload.createdBy || null,
  });

  return { success: true, student: toExternalStudentShape(student) };
}

export async function updateStudentResume(phone, resumeData, companyId) {
  const normalized = normalizePhone(phone);
  const query = {
    $or: [{ phoneNormalized: normalized }, { phone }],
  };
  if (companyId) query.companyId = companyId;
  const student = await Student.findOne(query);
  if (!student) throw new Error('Student not found');

  student.resume = resumeData;
  // Never overwrite the student's marketing / target role from resume.jobtitle.
  // Fix-for-job and ATS flows often set resume.jobtitle to a specific opening;
  // syncing that into student.role breaks recruiter job matching for the student.
  // Role is only updated via student profile / details editors.
  await student.save();
  return { success: true, error: false, msg: 'Resume Updated' };
}

/**
 * Update student profile / subscription fields used by the Student Details + Subscription editors.
 */
export async function updateStudentProfile(phone, payload = {}, companyId) {
  const normalized = normalizePhone(phone);
  const query = {
    $or: [{ phoneNormalized: normalized }, { phone }],
  };
  if (companyId) query.companyId = companyId;
  const student = await Student.findOne(query);
  if (!student) throw new Error('Student not found');

  const setIf = (key, value) => {
    if (value === undefined) return;
    student[key] = value;
  };

  if (payload.firstName !== undefined || payload.lastName !== undefined) {
    const firstName =
      payload.firstName !== undefined ? String(payload.firstName || '').trim() : student.firstName;
    const lastName =
      payload.lastName !== undefined ? String(payload.lastName || '').trim() : student.lastName;
    student.firstName = firstName;
    student.lastName = lastName;
    if (payload.name !== undefined) {
      student.name = String(payload.name || '').trim() || `${firstName} ${lastName}`.trim();
    } else {
      student.name = `${firstName} ${lastName}`.trim() || student.name;
    }
  } else if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (name) {
      student.name = name;
      const parts = splitName(name);
      student.firstName = parts.firstName;
      student.lastName = parts.lastName;
    }
  }

  setIf('email', payload.email !== undefined ? String(payload.email || '').trim().toLowerCase() : undefined);
  setIf('role', payload.role !== undefined ? String(payload.role || '').trim() : undefined);
  setIf('city', payload.city !== undefined ? String(payload.city || '').trim() : undefined);
  setIf('state', payload.state !== undefined ? String(payload.state || '').trim() : undefined);
  setIf('linkedin', payload.linkedin !== undefined ? String(payload.linkedin || '').trim() : undefined);
  setIf('visa', payload.visa !== undefined ? String(payload.visa || '').trim() : undefined);
  setIf(
    'recruiterUsername',
    payload.recruiterUsername !== undefined
      ? String(payload.recruiterUsername || '').trim()
      : undefined
  );
  setIf('joinDate', payload.joinDate !== undefined ? String(payload.joinDate || '').trim() : undefined);

  if (payload.status !== undefined) {
    const status = String(payload.status || '').trim().toLowerCase();
    if (['active', 'inactive', 'suspended'].includes(status)) {
      student.status = status;
    }
  }

  if (payload.subscriptionAmount !== undefined) {
    const amount = Number(payload.subscriptionAmount);
    student.subscriptionAmount = Number.isFinite(amount) ? amount : 0;
  }

  if (payload.subscriptionDays !== undefined) {
    const days = Number(payload.subscriptionDays);
    student.subscriptionDays = Number.isFinite(days) ? days : 0;
  }

  if (payload.subscriptionDate !== undefined) {
    if (!payload.subscriptionDate) {
      student.subscriptionDate = null;
    } else {
      const d = new Date(payload.subscriptionDate);
      student.subscriptionDate = Number.isNaN(d.getTime()) ? null : d;
    }
  }

  if (payload.additionalDetails !== undefined) {
    const rows = Array.isArray(payload.additionalDetails) ? payload.additionalDetails : [];
    student.additionalDetails = rows
      .map((row) => ({
        key: String(row?.key || row?.label || '').trim(),
        data: String(row?.data || row?.value || '').trim(),
      }))
      .filter((row) => row.key);
  }

  if (payload.phone !== undefined) {
    const nextPhone = String(payload.phone || '').trim();
    if (nextPhone && nextPhone !== student.phone) {
      const nextNormalized = normalizePhone(nextPhone);
      const clash = await Student.findOne({
        companyId: student.companyId,
        phoneNormalized: nextNormalized,
        _id: { $ne: student._id },
      });
      if (clash) throw new Error('Another student already uses this phone number');
      student.phone = nextPhone;
      student.phoneNormalized = nextNormalized;
    }
  }

  await student.save();
  return toExternalStudentShape(student);
}

export async function buildResumeDownload(phone, options = {}) {
  const details = await fetchStudentDetails(phone, options.companyId);
  if (!details) throw new Error('Student not found');

  const { buildResumeDocxBuffer, persistResumeDownload } = await import(
    './resumeDocx.service.js'
  );

  const buffer = await buildResumeDocxBuffer(details, options);
  const publicBaseUrl =
    options.publicBaseUrl ||
    process.env.SERVER_URL ||
    `http://localhost:${process.env.PORT || 5000}`;

  const persisted = await persistResumeDownload({
    buffer,
    details,
    publicBaseUrl,
  });

  return {
    success: true,
    mock: false,
    downloadUrl: persisted.downloadUrl,
    filename: persisted.filename,
    resume: details.resume || options.resume || null,
    message: 'Resume DOCX generated',
  };
}

export async function createLocalStudentForCompany(company, payload, createdBy = null) {
  return createStudent({
    ...payload,
    company: company._id.toString(),
    companyId: company._id.toString(),
    createdBy,
  });
}
