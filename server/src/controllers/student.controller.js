import Company from '../models/Company.js';
import Student from '../models/Student.js';
import StudentNote from '../models/StudentNote.js';
import PaymentRecord from '../models/PaymentRecord.js';
import SubscriptionSchedule from '../models/SubscriptionSchedule.js';
import BillingRecord from '../models/BillingRecord.js';
import Ticket from '../models/Ticket.js';
import Interview from '../models/Interview.js';
import {
  createStudent,
  fetchStudents,
  normalizePhone,
  resolveApiCompanyName,
  toExternalStudentShape,
  updateStudentProfile,
} from '../services/nexusStudentApi.service.js';
import { buildResumeFromFormData } from '../services/resumeEnrich.service.js';
import { formatFormAddress, normalizeResumeFormData } from '../constants/resumeForm.js';
import { getStudentActivityCounts } from '../services/recruiterPortal.service.js';

async function resolveCompany(user, companyId) {
  let targetId = user.companyId._id;
  if (user.isPlatformAdmin && companyId) targetId = companyId;
  const company = await Company.findById(targetId);
  if (!company) throw new Error('Company not found');
  return company;
}

function normalizeStudent(s, companyId) {
  const phone = (s.phone || s.mobile || s.studentid || '').toString();
  const name = (
    s.name ||
    s.studentname ||
    `${s.firstname || ''} ${s.lastname || ''}`.trim() ||
    'Unknown'
  ).toString();
  const resume = s.resume && typeof s.resume === 'object' ? s.resume : null;
  const hasResume = !!(
    resume &&
    (resume.jobtitle ||
      resume.experience?.length ||
      resume.education?.length ||
      resume.professionalsummary_points?.length ||
      resume.techinicalskills?.length)
  );
  const status = String(s.status || 'active').toLowerCase();
  return {
    phone,
    name,
    email: (s.email || '').toString(),
    companyId,
    role: (s.role || resume?.jobtitle || '').toString(),
    status: ['active', 'inactive', 'suspended'].includes(status) ? status : 'active',
    recruiter: (s.recruiterId || s.recruiterUsername || '').toString(),
    subscriptionDays: Number(s.subscription_days || s.subscriptionDays || 0) || 0,
    hasResume,
    raw: s,
  };
}

export async function listStudents(req, res) {
  try {
    const company = await resolveCompany(req.user, req.query.companyId);
    const students = await fetchStudents(company._id.toString());

    const q = (req.query.q || '').toLowerCase();
    const normalized = students.map((s) => normalizeStudent(s, company._id.toString()));

    const filtered = q
      ? normalized.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.phone.includes(q) ||
            s.email.toLowerCase().includes(q)
        )
      : normalized;

    const phones = filtered.map((s) => s.phone).filter(Boolean);
    const [payments, subscriptions] = await Promise.all([
      PaymentRecord.find({ companyId: company._id, studentPhone: { $in: phones }, status: 'paid' }),
      SubscriptionSchedule.find({ companyId: company._id, studentPhone: { $in: phones }, status: 'active' }),
    ]);

    const paymentMap = new Map();
    payments.forEach((p) => {
      paymentMap.set(p.studentPhone, (paymentMap.get(p.studentPhone) || 0) + 1);
    });
    const subSet = new Set(subscriptions.map((s) => s.studentPhone));

    const studentsOut = filtered.map((s) => ({
      ...s,
      companyLabel: company.name,
      paymentCount: paymentMap.get(s.phone) || 0,
      hasActiveSubscription: subSet.has(s.phone),
    }));

    const stats = {
      all: studentsOut.length,
      active: studentsOut.filter((s) => s.status === 'active').length,
      inactive: studentsOut.filter((s) => s.status === 'inactive').length,
      suspended: studentsOut.filter((s) => s.status === 'suspended').length,
    };

    return res.json({ students: studentsOut, stats });
  } catch (err) {
    console.error('List students error:', err);
    return res.status(500).json({ error: err.message || 'Failed to list students' });
  }
}

export async function lookupStudentByPhone(req, res) {
  try {
    const company = await resolveCompany(req.user, req.query.companyId);
    const phone = String(req.query.phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const student = await Student.findOne({
      companyId: company._id,
      phoneNormalized: normalizePhone(phone),
    });

    if (!student) return res.json({ exists: false, student: null });
    return res.json({
      exists: true,
      student: {
        id: student._id.toString(),
        name: student.name,
        phone: student.phone,
        email: student.email,
      },
    });
  } catch (err) {
    console.error('Student phone lookup error:', err);
    return res.status(500).json({ error: err.message || 'Failed to search student' });
  }
}

export async function getStudent(req, res) {
  try {
    const phone = req.params.phone;
    const company = await resolveCompany(req.user, req.query.companyId);
    const normalized = normalizePhone(phone);
    const local = await Student.findOne({
      companyId: company._id,
      $or: [{ phoneNormalized: normalized }, { phone }],
    });
    if (!local) return res.status(404).json({ error: 'Student not found' });
    const details = toExternalStudentShape(local);

    const note = await StudentNote.findOne({ companyId: company._id, studentPhone: phone });
    const [payments, subscription, tickets, interviews, billing, activity] = await Promise.all([
      PaymentRecord.find({ companyId: company._id, studentPhone: phone }).sort({ createdAt: -1 }).limit(20),
      SubscriptionSchedule.findOne({ companyId: company._id, studentPhone: phone, status: 'active' }),
      Ticket.find({ companyId: company._id, $or: [{ phone }, { studentPhone: phone }], isDeleted: false }).limit(10),
      Interview.find({ companyId: company._id, $or: [{ phone }, { studentPhone: phone }], isDeleted: false }).limit(10),
      BillingRecord.find({ companyId: company._id, studentPhone: phone }).sort({ billingMonth: -1 }).limit(12),
      getStudentActivityCounts(company._id, phone),
    ]);

    return res.json({
      student: {
        phone,
        details,
        notes: note?.notes || '',
        companyId: company._id.toString(),
        companyLabel: company.name,
      },
      payments,
      subscription,
      tickets: tickets.map((t) => ({
        id: t._id.toString(),
        ticketNumber: t.ticketNumber,
        candidateName: t.candidateName,
        currentStage: t.currentStage,
      })),
      interviews: interviews.map((i) => ({
        id: i._id.toString(),
        interviewNumber: i.interviewNumber,
        candidateName: i.candidateName,
        currentStage: i.currentStage,
        position: i.position || '',
        companyName: i.companyName || '',
        interviewDateTime: i.interviewDateTime || null,
        isCancelled: !!i.isCancelled,
      })),
      billing,
      activity,
    });
  } catch (err) {
    console.error('Get student error:', err);
    return res.status(500).json({ error: 'Failed to get student' });
  }
}

function canAccessTicket(user, ticket) {
  if (user.isPlatformAdmin) return true;
  return ticket.companyId.toString() === user.companyId._id.toString();
}

function buildTicketStudentPrefill(ticket) {
  const form = normalizeResumeFormData(ticket.resumeFormData || {});
  const formattedAddress = formatFormAddress(form);
  const additionalDetails = [
    ['Date of Birth', form.dateOfBirth],
    ['Address', formattedAddress],
    ['Visa Status', form.visaStatus],
    ['Date of Arrival USA', form.dateOfArrivalUSA],
    ['Vendor call', form.vendorCallTime],
    ['Certifications', form.certifications],
    ['Technical Skills', form.technicalSkills],
    ['Relevant Coursework', form.relevantCoursework],
    ['Masters University', form.mastersUniversity],
    ['Masters Field', form.mastersField],
    ['Masters Start Date', form.mastersStartDate],
    [
      'Masters End Date',
      form.mastersEndDate ||
        [form.mastersGraduatedMonth, form.mastersGraduatedYear].filter(Boolean).join(' '),
    ],
    ['Bachelors University', form.bachelorsUniversity],
    ['Bachelors Field', form.bachelorsField],
    ['Bachelors Start Date', form.bachelorsStartDate],
    [
      'Bachelors End Date',
      form.bachelorsEndDate ||
        [form.bachelorsGraduatedMonth, form.bachelorsGraduatedYear].filter(Boolean).join(' '),
    ],
  ]
    .filter(([, value]) => value)
    .map(([key, data]) => ({ key, data }));

  return {
    name: form.preferredName || form.legalName || ticket.candidateName || '',
    email: form.resumeEmail || ticket.email || '',
    mobile: form.personalPhone || ticket.phone || '',
    role: form.preferredRole || '',
    linkedin: form.linkedIn || '',
    address: formattedAddress,
    city: form.city || '',
    state: form.state || '',
    zipCode: form.zipCode || '',
    country: form.country || '',
    visa: form.visaStatus || '',
    additionalDetails,
  };
}

function buildResumeFromTicketForm(ticket) {
  return buildResumeFromFormData(ticket.resumeFormData || {}, ticket);
}

export async function getTicketStudentProfile(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    let student = null;
    if (ticket.studentId) {
      student = await Student.findOne({ _id: ticket.studentId, companyId: ticket.companyId });
    }

    if (!student) {
      const phone = ticket.studentPhone || ticket.phone;
      const normalized = normalizePhone(phone);
      if (normalized) {
        student = await Student.findOne({
          companyId: ticket.companyId,
          phoneNormalized: normalized,
        });
      }
    }

    if (student) {
      if (!ticket.studentId || ticket.studentPhone !== student.phone) {
        ticket.studentId = student._id;
        ticket.studentPhone = student.phone;
        await ticket.save();
      }
      return res.json({
        exists: true,
        student: {
          id: student._id.toString(),
          phone: student.phone,
          name: student.name,
          email: student.email,
        },
      });
    }

    return res.json({
      exists: false,
      ticket: {
        id: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        companyId: ticket.companyId.toString(),
        resumeFormStatus: ticket.resumeFormStatus,
      },
      prefill: buildTicketStudentPrefill(ticket),
    });
  } catch (err) {
    console.error('Resolve ticket student error:', err);
    return res.status(500).json({ error: err.message || 'Failed to resolve student profile' });
  }
}

export async function createStudentFromTicket(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket || ticket.isDeleted) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });

    const company = await Company.findById(ticket.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const expected = company.createStudentPassword || process.env.CREATE_STUDENT_PASSWORD || '';
    if (expected && req.body.password !== expected) {
      return res.status(403).json({ error: 'Invalid create student password' });
    }

    const prefill = buildTicketStudentPrefill(ticket);
    const payload = { ...prefill, ...req.body };
    if (!payload.name || !payload.mobile) {
      return res.status(400).json({ error: 'Name and mobile are required' });
    }

    const normalized = normalizePhone(payload.mobile);
    let student = await Student.findOne({
      companyId: company._id,
      phoneNormalized: normalized,
    });
    let created = false;

    if (!student) {
      const additionalDetails = [...(payload.additionalDetails || prefill.additionalDetails || [])];
      const setDetail = (key, data) => {
        if (!data) return;
        const index = additionalDetails.findIndex(
          (item) => item.key?.toLowerCase() === key.toLowerCase()
        );
        if (index >= 0) additionalDetails[index] = { ...additionalDetails[index], key, data };
        else additionalDetails.push({ key, data });
      };
      setDetail('Address', payload.address || formatFormAddress(ticket.resumeFormData || {}));
      setDetail('Visa Status', payload.visa);

      const result = await createStudent({
        name: payload.name,
        email: payload.email || '',
        mobile: payload.mobile,
        role: payload.role || '',
        city: payload.city || '',
        state: payload.state || '',
        linkedin: payload.linkedin || '',
        additionalDetails,
        visa: payload.visa || '',
        resume: buildResumeFromTicketForm(ticket),
        company: company._id.toString(),
        createdBy: req.user._id,
      });
      student = await Student.findById(result.student._id);
      created = true;
    }

    ticket.studentId = student._id;
    ticket.studentPhone = student.phone;
    ticket.candidateName = student.name;
    ticket.phone = student.phone;
    if (student.email) ticket.email = student.email;
    await ticket.save();

    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      student: {
        id: student._id.toString(),
        phone: student.phone,
        name: student.name,
        email: student.email,
      },
      ticketId: ticket._id.toString(),
    });
  } catch (err) {
    console.error('Create student from ticket error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create student' });
  }
}

export async function createStudentRecord(req, res) {
  try {
    const { password, name, email, mobile, companyId } = req.body;
    const company = await resolveCompany(req.user, companyId);

    const expected = company.createStudentPassword || process.env.CREATE_STUDENT_PASSWORD || '';
    if (expected && password !== expected) {
      return res.status(403).json({ error: 'Invalid create student password' });
    }

    if (!name || !mobile) {
      return res.status(400).json({ error: 'Name and mobile are required' });
    }

    const result = await createStudent({
      name,
      email: email || '',
      mobile,
      company: company._id.toString(),
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, result });
  } catch (err) {
    console.error('Create student error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create student' });
  }
}

export async function updateStudentNotes(req, res) {
  try {
    const phone = req.params.phone;
    const company = await resolveCompany(req.user, req.body.companyId);
    const { notes } = req.body;

    const note = await StudentNote.findOneAndUpdate(
      { companyId: company._id, studentPhone: phone },
      { notes: notes || '', updatedBy: req.user._id },
      { upsert: true, new: true }
    );

    return res.json({ notes: note.notes });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save notes' });
  }
}

export async function updateStudent(req, res) {
  try {
    const phone = req.params.phone;
    const company = await resolveCompany(req.user, req.body.companyId);
    const details = await updateStudentProfile(phone, req.body, company._id);

    if (req.body.notes !== undefined) {
      await StudentNote.findOneAndUpdate(
        { companyId: company._id, studentPhone: details.phone || phone },
        { notes: req.body.notes || '', updatedBy: req.user._id },
        { upsert: true, new: true }
      );
    }

    // Keep notes keyed to the (possibly updated) phone
    if (details.phone && details.phone !== phone && req.body.notes === undefined) {
      const existing = await StudentNote.findOne({ companyId: company._id, studentPhone: phone });
      if (existing) {
        existing.studentPhone = details.phone;
        await existing.save();
      }
    }

    const note = await StudentNote.findOne({
      companyId: company._id,
      studentPhone: details.phone || phone,
    });

    return res.json({
      success: true,
      student: {
        phone: details.phone || phone,
        details,
        notes: note?.notes || '',
        companyId: company._id.toString(),
        companyLabel: company.name,
      },
    });
  } catch (err) {
    console.error('Update student error:', err);
    const status = /not found/i.test(err.message)
      ? 404
      : /already uses this phone/i.test(err.message)
        ? 409
        : 500;
    return res.status(status).json({ error: err.message || 'Failed to update student' });
  }
}

// Keep resolveApiCompanyName import used by other modules via re-export if needed
export { resolveApiCompanyName };
