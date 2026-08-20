import EmployeeSalary from '../models/EmployeeSalary.js';
import EmployeeLeave from '../models/EmployeeLeave.js';
import EmployeeMonthlyLeave from '../models/EmployeeMonthlyLeave.js';
import User from '../models/User.js';
import RecruiterAccount from '../models/RecruiterAccount.js';
import Company from '../models/Company.js';
import { getCompanyFilter } from '../services/billing.service.js';
import { verifySalariesPassword } from '../middleware/auth.js';
import { getSalaryCurrency } from '../constants/payment.js';
import { calculateMonthlyPayout } from '../services/salaryCalculation.service.js';

function employeeKey(employeeType, id) {
  return `${employeeType === 'recruiter' ? 'recruiter' : 'user'}:${id}`;
}

function employeeDisplayName(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const type = o.employeeType === 'recruiter' ? 'recruiter' : 'user';
  if (type === 'recruiter') {
    return o.recruiterId?.name || '';
  }
  return o.userId?.name || '';
}

function employeeDisplayEmail(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const type = o.employeeType === 'recruiter' ? 'recruiter' : 'user';
  if (type === 'recruiter') {
    return o.recruiterId?.email || '';
  }
  return o.userId?.email || '';
}

function salaryToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const employeeType = o.employeeType === 'recruiter' ? 'recruiter' : 'user';
  return {
    id: o._id.toString(),
    employeeType,
    userId:
      employeeType === 'user'
        ? o.userId?._id?.toString() ?? o.userId?.toString() ?? ''
        : '',
    recruiterId:
      employeeType === 'recruiter'
        ? o.recruiterId?._id?.toString() ?? o.recruiterId?.toString() ?? ''
        : '',
    userName: employeeDisplayName(doc),
    userEmail: employeeDisplayEmail(doc),
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    monthlySalary: o.monthlySalary,
    currency: o.currency,
    effectiveFrom: o.effectiveFrom,
    allowedLeaves: o.allowedLeaves ?? 0,
    status: o.status || 'active',
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function leaveToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const employeeType = o.employeeType === 'recruiter' ? 'recruiter' : 'user';
  return {
    id: o._id.toString(),
    employeeType,
    userId:
      employeeType === 'user'
        ? o.userId?._id?.toString() ?? o.userId?.toString() ?? ''
        : '',
    recruiterId:
      employeeType === 'recruiter'
        ? o.recruiterId?._id?.toString() ?? o.recruiterId?.toString() ?? ''
        : '',
    userName: employeeDisplayName(doc),
    companyId: o.companyId?.toString(),
    leaveType: o.leaveType,
    startDate: o.startDate,
    endDate: o.endDate,
    days: o.days,
    status: o.status,
    reason: o.reason,
    createdAt: o.createdAt,
  };
}

/** Parse employeeKey (`user:id` / `recruiter:id`) or legacy userId + employeeType. */
function resolveEmployeeInput(body) {
  const rawKey = String(body.employeeKey || '').trim();
  if (rawKey.includes(':')) {
    const [type, id] = rawKey.split(':');
    if (type === 'recruiter' && id) {
      return { employeeType: 'recruiter', userId: null, recruiterId: id };
    }
    if (id) {
      return { employeeType: 'user', userId: id, recruiterId: null };
    }
  }

  const employeeType = body.employeeType === 'recruiter' ? 'recruiter' : 'user';
  if (employeeType === 'recruiter') {
    const recruiterId = body.recruiterId || body.userId;
    if (!recruiterId) {
      const err = new Error('recruiterId is required');
      err.status = 400;
      throw err;
    }
    return { employeeType: 'recruiter', userId: null, recruiterId };
  }

  const userId = body.userId;
  if (!userId) {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }
  return { employeeType: 'user', userId, recruiterId: null };
}

async function assertEmployeeExists(employeeType, userId, recruiterId, companyId) {
  if (employeeType === 'recruiter') {
    const recruiter = await RecruiterAccount.findOne({ _id: recruiterId, companyId });
    if (!recruiter) {
      const err = new Error('Recruiter not found');
      err.status = 404;
      throw err;
    }
    return recruiter;
  }

  const user = await User.findOne({ _id: userId, companyId });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

function salaryLookupFilter(companyId, employeeType, userId, recruiterId) {
  if (employeeType === 'recruiter') {
    return { companyId, employeeType: 'recruiter', recruiterId };
  }
  return {
    companyId,
    userId,
    $or: [{ employeeType: 'user' }, { employeeType: { $exists: false } }],
  };
}

function parseDateRange(query) {
  const from = query.from || query.dateFrom;
  const to = query.to || query.dateTo;
  let fromDate = null;
  let toDate = null;

  if (from) {
    fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) {
      throw new Error('Invalid from date');
    }
    fromDate.setHours(0, 0, 0, 0);
  }

  if (to) {
    toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) {
      throw new Error('Invalid to date');
    }
    toDate.setHours(23, 59, 59, 999);
  }

  if (fromDate && toDate && fromDate > toDate) {
    throw new Error('From date must be before to date');
  }

  return { fromDate, toDate };
}

function applySalaryDateFilter(filter, fromDate, toDate) {
  if (!fromDate && !toDate) return filter;

  const range = {};
  if (fromDate) range.$gte = fromDate;
  if (toDate) range.$lte = toDate;

  return {
    ...filter,
    $or: [
      { effectiveFrom: { ...range, $ne: null } },
      {
        $and: [
          { $or: [{ effectiveFrom: null }, { effectiveFrom: { $exists: false } }] },
          { createdAt: range },
        ],
      },
    ],
  };
}

function applyLeaveDateFilter(filter, fromDate, toDate) {
  if (!fromDate && !toDate) return filter;

  const next = { ...filter };
  if (fromDate) next.endDate = { ...(next.endDate || {}), $gte: fromDate };
  if (toDate) next.startDate = { ...(next.startDate || {}), $lte: toDate };
  return next;
}

export async function verifyPassword(req, res) {
  const { password } = req.body;
  if (!verifySalariesPassword(password)) {
    return res.status(403).json({ error: 'Invalid password' });
  }
  return res.json({ success: true });
}

/** Portal users + recruiters for salary/leave employee dropdown. */
export async function listSalaryEmployees(req, res) {
  try {
    const companyFilter = getCompanyFilter(req.user, req.query.companyId);
    const userQuery = companyFilter.companyId ? { companyId: companyFilter.companyId } : {};

    const [users, recruiters] = await Promise.all([
      User.find(userQuery).sort({ name: 1 }),
      RecruiterAccount.find(userQuery).sort({ name: 1 }),
    ]);

    const employees = [
      ...users.map((u) => ({
        key: `user:${u._id.toString()}`,
        type: 'user',
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        label: u.name,
        role: u.role,
      })),
      ...recruiters.map((r) => ({
        key: `recruiter:${r._id.toString()}`,
        type: 'recruiter',
        id: r._id.toString(),
        name: r.name,
        email: r.email || '',
        label: `${r.name} (Recruiter)`,
        username: r.username,
      })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ employees });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to list employees' });
  }
}

export async function listSalaries(req, res) {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const filter = applySalaryDateFilter(getCompanyFilter(req.user, req.query.companyId), fromDate, toDate);
    const items = await EmployeeSalary.find(filter)
      .populate('userId', 'name email')
      .populate('recruiterId', 'name email username')
      .populate('companyId', 'name')
      .sort({ updatedAt: -1 });
    return res.json({ salaries: items.map(salaryToJSON) });
  } catch (err) {
    if (err.message?.includes('date')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to list salaries' });
  }
}

export async function upsertSalary(req, res) {
  try {
    const { monthlySalary, currency, effectiveFrom, notes, companyId, allowedLeaves, status } =
      req.body;
    const { employeeType, userId, recruiterId } = resolveEmployeeInput(req.body);
    if (monthlySalary == null) {
      return res.status(400).json({ error: 'monthlySalary is required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    await assertEmployeeExists(employeeType, userId, recruiterId, company._id);

    const allowed = Math.max(0, Number(allowedLeaves) || 0);

    let item = await EmployeeSalary.findOne(
      salaryLookupFilter(company._id, employeeType, userId, recruiterId)
    );
    if (item) {
      item.employeeType = employeeType;
      item.userId = employeeType === 'user' ? userId : null;
      item.recruiterId = employeeType === 'recruiter' ? recruiterId : null;
      item.monthlySalary = Math.round(monthlySalary);
      item.currency = currency || getSalaryCurrency(company);
      item.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : item.effectiveFrom;
      item.allowedLeaves = allowed;
      if (status === 'discontinued' || status === 'active') item.status = status;
      item.notes = notes ?? item.notes;
      item.updatedBy = req.user._id;
      await item.save();
    } else {
      item = await EmployeeSalary.create({
        employeeType,
        userId: employeeType === 'user' ? userId : null,
        recruiterId: employeeType === 'recruiter' ? recruiterId : null,
        companyId: company._id,
        monthlySalary: Math.round(monthlySalary),
        currency: currency || getSalaryCurrency(company),
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        allowedLeaves: allowed,
        status: status === 'discontinued' ? 'discontinued' : 'active',
        notes: notes || '',
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
    }

    const populated = await EmployeeSalary.findById(item._id)
      .populate('userId', 'name email')
      .populate('recruiterId', 'name email username');
    return res.json({ salary: salaryToJSON(populated) });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to save salary' });
  }
}

export async function deleteSalary(req, res) {
  try {
    const item = await EmployeeSalary.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Salary record not found' });
    await item.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete salary' });
  }
}

export async function listLeaves(req, res) {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const filter = applyLeaveDateFilter(getCompanyFilter(req.user, req.query.companyId), fromDate, toDate);
    const items = await EmployeeLeave.find(filter)
      .populate('userId', 'name email')
      .populate('recruiterId', 'name email username')
      .sort({ createdAt: -1 });
    return res.json({ leaves: items.map(leaveToJSON) });
  } catch (err) {
    if (err.message?.includes('date')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to list leaves' });
  }
}

export async function createLeave(req, res) {
  try {
    const { leaveType, startDate, endDate, days, reason, companyId } = req.body;
    const { employeeType, userId, recruiterId } = resolveEmployeeInput(req.body);
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    await assertEmployeeExists(employeeType, userId, recruiterId, targetCompanyId);

    const item = await EmployeeLeave.create({
      employeeType,
      userId: employeeType === 'user' ? userId : null,
      recruiterId: employeeType === 'recruiter' ? recruiterId : null,
      companyId: targetCompanyId,
      leaveType: leaveType || 'casual',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: days || 1,
      reason: reason || '',
      createdBy: req.user._id,
    });

    const populated = await EmployeeLeave.findById(item._id)
      .populate('userId', 'name email')
      .populate('recruiterId', 'name email username');
    return res.status(201).json({ leave: leaveToJSON(populated) });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to create leave' });
  }
}

export async function updateLeave(req, res) {
  try {
    const item = await EmployeeLeave.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Leave not found' });

    if (req.body.status) {
      item.status = req.body.status;
      if (req.body.status === 'approved') item.approvedBy = req.user._id;
    }
    if (req.body.reason !== undefined) item.reason = req.body.reason;

    await item.save();
    const populated = await EmployeeLeave.findById(item._id)
      .populate('userId', 'name email')
      .populate('recruiterId', 'name email username');
    return res.json({ leave: leaveToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update leave' });
  }
}

function buildSalaryRow({
  key,
  employeeType,
  id,
  name,
  email,
  isActive,
  salary,
  monthlyLeave,
  year,
  month,
  currency,
}) {
  const hasSalaryRecord = !!salary;
  const discontinued = !isActive || salary?.status === 'discontinued';
  const paysThisMonth = hasSalaryRecord && salary.status !== 'discontinued' && isActive;

  let category = 'no_salary';
  if (discontinued) category = 'discontinued';
  else if (hasSalaryRecord) category = 'with_salary';

  let leaveDates = monthlyLeave?.leaveDates || [];
  const allowedLeaves = salary?.allowedLeaves ?? 0;
  const monthlySalary = salary?.monthlySalary ?? 0;
  let leaveDays = 0;
  let deductibleDays = 0;
  let expected = 0;
  let actual = 0;

  if (paysThisMonth) {
    const calc = calculateMonthlyPayout({
      monthlySalary,
      allowedLeaves,
      leaveDates,
      effectiveFrom: salary?.effectiveFrom || null,
      year,
      month,
    });
    leaveDays = calc.leaveDays;
    deductibleDays = calc.deductibleDays;
    expected = calc.expected;
    actual =
      monthlyLeave?.actualSalary != null ? Math.round(monthlyLeave.actualSalary) : expected;
    leaveDates = calc.leaveDates;
  }

  return {
    employeeKey: key,
    employeeType,
    employeeId: id,
    name,
    email,
    category,
    salaryId: salary?._id?.toString() || null,
    startDate: salary?.effectiveFrom || null,
    monthlySalary,
    currency: salary?.currency || currency,
    allowedLeaves,
    status: salary?.status || 'active',
    notes: salary?.notes || '',
    leaveDays,
    deductibleDays,
    leaveDates,
    expected,
    actual,
    monthlyLeaveId: monthlyLeave?._id?.toString() || null,
  };
}

/** Dashboard grid + summary stats for a calendar month. */
export async function getSalaryDashboard(req, res) {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'month must be 1–12' });
    }

    const companyFilter = getCompanyFilter(req.user, req.query.companyId);
    const userQuery = companyFilter.companyId ? { companyId: companyFilter.companyId } : {};
    const salaryQuery = companyFilter.companyId ? { companyId: companyFilter.companyId } : {};
    const leaveQuery = { ...userQuery, year, month };

    const companyDoc = companyFilter.companyId
      ? await Company.findById(companyFilter.companyId)
      : null;
    const currency = companyDoc ? getSalaryCurrency(companyDoc) : 'INR';

    const [users, recruiters, salaries, monthlyLeaves] = await Promise.all([
      User.find(userQuery).sort({ name: 1 }),
      RecruiterAccount.find(userQuery).sort({ name: 1 }),
      EmployeeSalary.find(salaryQuery),
      EmployeeMonthlyLeave.find(leaveQuery),
    ]);

    const salaryByKey = new Map();
    for (const s of salaries) {
      const type = s.employeeType === 'recruiter' ? 'recruiter' : 'user';
      const id = type === 'recruiter' ? s.recruiterId?.toString() : s.userId?.toString();
      if (id) salaryByKey.set(employeeKey(type, id), s);
    }

    const leaveByKey = new Map();
    for (const ml of monthlyLeaves) {
      const type = ml.employeeType === 'recruiter' ? 'recruiter' : 'user';
      const id = type === 'recruiter' ? ml.recruiterId?.toString() : ml.userId?.toString();
      if (id) leaveByKey.set(employeeKey(type, id), ml);
    }

    const rows = [];

    for (const u of users) {
      const key = employeeKey('user', u._id.toString());
      rows.push(
        buildSalaryRow({
          key,
          employeeType: 'user',
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          isActive: u.isActive !== false,
          salary: salaryByKey.get(key),
          monthlyLeave: leaveByKey.get(key),
          year,
          month,
          currency,
        })
      );
    }

    for (const r of recruiters) {
      const key = employeeKey('recruiter', r._id.toString());
      rows.push(
        buildSalaryRow({
          key,
          employeeType: 'recruiter',
          id: r._id.toString(),
          name: r.name,
          email: r.email || '',
          isActive: r.isActive !== false,
          salary: salaryByKey.get(key),
          monthlyLeave: leaveByKey.get(key),
          year,
          month,
          currency,
        })
      );
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));

    const withSalaryRows = rows.filter((r) => r.category === 'with_salary');
    const stats = {
      totalEmployees: rows.length,
      noSalarySet: rows.filter((r) => r.category === 'no_salary').length,
      withSalary: withSalaryRows.length,
      discontinued: rows.filter((r) => r.category === 'discontinued').length,
      expectedTotal: withSalaryRows.reduce((sum, r) => sum + r.expected, 0),
      actualTotal: withSalaryRows.reduce((sum, r) => sum + r.actual, 0),
    };

    return res.json({ year, month, currency, stats, rows });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load salary dashboard' });
  }
}

export async function getMonthlyLeave(req, res) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    const { employeeType, userId, recruiterId } = resolveEmployeeInput({
      employeeKey: req.query.employeeKey,
      employeeType: req.query.employeeType,
      userId: req.query.userId,
      recruiterId: req.query.recruiterId,
    });

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && req.query.companyId) {
      targetCompanyId = req.query.companyId;
    }

    const filter = {
      companyId: targetCompanyId,
      employeeType,
      year,
      month,
      ...(employeeType === 'recruiter' ? { recruiterId } : { userId }),
    };

    const item = await EmployeeMonthlyLeave.findOne(filter);
    return res.json({
      monthlyLeave: item
        ? {
            id: item._id.toString(),
            leaveDates: item.leaveDates || [],
            actualSalary: item.actualSalary,
          }
        : { leaveDates: [], actualSalary: null },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to load monthly leave' });
  }
}

export async function saveMonthlyLeave(req, res) {
  try {
    const year = parseInt(req.body.year, 10);
    const month = parseInt(req.body.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'year and month (1–12) are required' });
    }

    const { employeeType, userId, recruiterId } = resolveEmployeeInput(req.body);
    const leaveDates = Array.isArray(req.body.leaveDates)
      ? [...new Set(req.body.leaveDates.map((d) => String(d).slice(0, 10)))].sort()
      : [];

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && req.body.companyId) {
      targetCompanyId = req.body.companyId;
    }

    await assertEmployeeExists(employeeType, userId, recruiterId, targetCompanyId);

    const filter = {
      companyId: targetCompanyId,
      employeeType,
      year,
      month,
      ...(employeeType === 'recruiter' ? { recruiterId } : { userId }),
    };

    const update = {
      leaveDates,
      updatedBy: req.user._id,
    };
    if (req.body.actualSalary != null && req.body.actualSalary !== '') {
      update.actualSalary = Math.round(Number(req.body.actualSalary));
    }

    const item = await EmployeeMonthlyLeave.findOneAndUpdate(
      filter,
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      monthlyLeave: {
        id: item._id.toString(),
        leaveDates: item.leaveDates,
        actualSalary: item.actualSalary,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to save monthly leave' });
  }
}
