import Counter from '../models/Counter.js';
import Company from '../models/Company.js';
import { fetchStudents, resolveApiCompanyName } from './nexusStudentApi.service.js';
import { getBillingCurrency } from '../constants/payment.js';

export function getCompanyFilter(user, queryCompanyId) {
  if (user.isPlatformAdmin) {
    return queryCompanyId ? { companyId: queryCompanyId } : {};
  }
  return { companyId: user.companyId._id };
}

export async function generateBillingNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'billing_number' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `BILL-${String(counter.seq).padStart(4, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function workingDaysInMonth(year, month) {
  const total = daysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function studentName(s) {
  return (s.name || s.studentname || '').toString().trim();
}

function studentPhone(s) {
  return (s.phone || s.mobile || s.studentid || '').toString().trim();
}

function studentId(s) {
  return (s.id || s.studentid || s._id || studentPhone(s)).toString();
}

function estimateActiveDays(student, year, month) {
  const fromApi = student.activeDays ?? student.activedays ?? student.active_days;
  if (fromApi != null && !Number.isNaN(Number(fromApi))) {
    return Math.max(0, Number(fromApi));
  }
  return workingDaysInMonth(year, month);
}

function shouldExcludeStudent(student, company) {
  const name = studentName(student).toLowerCase();
  const id = studentId(student);
  const skipNames = (company.skipBillingNames || []).map((n) => n.toLowerCase());
  if (skipNames.some((n) => name.includes(n))) {
    return 'Matched skip billing name';
  }
  if ((company.demoProfileIds || []).includes(id)) {
    return 'Demo profile';
  }
  return '';
}

export async function buildBillingPreview(companyId, year, month) {
  const company = await Company.findById(companyId);
  if (!company) throw new Error('Company not found');

  const apiName = resolveApiCompanyName(company);
  let students = [];
  try {
    students = await fetchStudents(apiName);
  } catch {
    students = [];
  }

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);
  const billingMonth = `${year}-${String(month).padStart(2, '0')}`;
  const rate = company.billRatePerDay ?? 4;
  const currency = getBillingCurrency(company);

  const lines = students.map((student) => {
    const excludedReason = shouldExcludeStudent(student, company);
    const activeDays = excludedReason ? 0 : estimateActiveDays(student, year, month);
    const totalAmount = excludedReason ? 0 : Math.round(activeDays * rate * 100);
    return {
      studentName: studentName(student) || 'Unknown',
      studentPhone: studentPhone(student),
      studentId: studentId(student),
      activeDays,
      billRatePerDay: rate,
      totalAmount,
      currency,
      excluded: !!excludedReason,
      excludedReason,
    };
  });

  const billable = lines.filter((l) => !l.excluded);
  const summary = {
    billingMonth,
    periodStart,
    periodEnd,
    companyId: company._id.toString(),
    companyName: company.name,
    billRatePerDay: rate,
    currency,
    totalStudents: lines.length,
    billableStudents: billable.length,
    excludedStudents: lines.length - billable.length,
    totalAmount: billable.reduce((s, l) => s + l.totalAmount, 0),
  };

  return { summary, lines };
}

export function billingRecordToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    billingNumber: o.billingNumber,
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    companyLabel: o.companyId?.name ?? '',
    periodStart: o.periodStart,
    periodEnd: o.periodEnd,
    billingMonth: o.billingMonth,
    studentName: o.studentName,
    studentPhone: o.studentPhone,
    studentId: o.studentId,
    activeDays: o.activeDays,
    billRatePerDay: o.billRatePerDay,
    totalAmount: o.totalAmount,
    currency: o.currency,
    status: o.status,
    excluded: o.excluded,
    excludedReason: o.excludedReason,
    invoiceNumber: o.invoiceNumber,
    batchId: o.batchId,
    createdAt: o.createdAt,
  };
}
