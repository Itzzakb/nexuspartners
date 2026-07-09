import Company from '../models/Company.js';
import StudentNote from '../models/StudentNote.js';
import PaymentRecord from '../models/PaymentRecord.js';
import SubscriptionSchedule from '../models/SubscriptionSchedule.js';
import BillingRecord from '../models/BillingRecord.js';
import Ticket from '../models/Ticket.js';
import Interview from '../models/Interview.js';
import {
  fetchStudents,
  fetchStudentDetails,
  createStudent,
  resolveApiCompanyName,
} from '../services/nexusStudentApi.service.js';
import { getCompanyFilter } from '../services/billing.service.js';

async function resolveCompany(user, companyId) {
  let targetId = user.companyId._id;
  if (user.isPlatformAdmin && companyId) targetId = companyId;
  const company = await Company.findById(targetId);
  if (!company) throw new Error('Company not found');
  return company;
}

function normalizeStudent(s, companyId) {
  const phone = (s.phone || s.mobile || s.studentid || '').toString();
  const name = (s.name || s.studentname || 'Unknown').toString();
  return {
    phone,
    name,
    email: (s.email || '').toString(),
    companyId,
    raw: s,
  };
}

export async function listStudents(req, res) {
  try {
    const company = await resolveCompany(req.user, req.query.companyId);
    const apiName = resolveApiCompanyName(company);
    let students = [];
    try {
      students = await fetchStudents(apiName);
    } catch {
      students = [];
    }

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

    return res.json({
      students: filtered.map((s) => ({
        ...s,
        companyLabel: company.name,
        paymentCount: paymentMap.get(s.phone) || 0,
        hasActiveSubscription: subSet.has(s.phone),
      })),
    });
  } catch (err) {
    console.error('List students error:', err);
    return res.status(500).json({ error: err.message || 'Failed to list students' });
  }
}

export async function getStudent(req, res) {
  try {
    const phone = req.params.phone;
    const company = await resolveCompany(req.user, req.query.companyId);

    let details = null;
    try {
      details = await fetchStudentDetails(phone);
    } catch {
      details = { phone, name: 'Student' };
    }

    const note = await StudentNote.findOne({ companyId: company._id, studentPhone: phone });
    const [payments, subscription, tickets, interviews, billing] = await Promise.all([
      PaymentRecord.find({ companyId: company._id, studentPhone: phone }).sort({ createdAt: -1 }).limit(20),
      SubscriptionSchedule.findOne({ companyId: company._id, studentPhone: phone, status: 'active' }),
      Ticket.find({ companyId: company._id, $or: [{ phone }, { studentPhone: phone }], isDeleted: false }).limit(10),
      Interview.find({ companyId: company._id, $or: [{ phone }, { studentPhone: phone }], isDeleted: false }).limit(10),
      BillingRecord.find({ companyId: company._id, studentPhone: phone }).sort({ billingMonth: -1 }).limit(12),
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
      tickets: tickets.map((t) => ({ id: t._id.toString(), ticketNumber: t.ticketNumber, candidateName: t.candidateName, currentStage: t.currentStage })),
      interviews: interviews.map((i) => ({ id: i._id.toString(), interviewNumber: i.interviewNumber, candidateName: i.candidateName, currentStage: i.currentStage })),
      billing,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get student' });
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
      company: resolveApiCompanyName(company),
    });

    return res.status(201).json({ success: true, result });
  } catch (err) {
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
