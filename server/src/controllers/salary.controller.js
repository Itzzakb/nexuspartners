import EmployeeSalary from '../models/EmployeeSalary.js';
import EmployeeLeave from '../models/EmployeeLeave.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { getCompanyFilter } from '../services/billing.service.js';
import { verifySalariesPassword } from '../middleware/auth.js';

function salaryToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    userId: o.userId?._id?.toString() ?? o.userId?.toString(),
    userName: o.userId?.name ?? '',
    userEmail: o.userId?.email ?? '',
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    monthlySalary: o.monthlySalary,
    currency: o.currency,
    effectiveFrom: o.effectiveFrom,
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function leaveToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    userId: o.userId?._id?.toString() ?? o.userId?.toString(),
    userName: o.userId?.name ?? '',
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

export async function verifyPassword(req, res) {
  const { password } = req.body;
  if (!verifySalariesPassword(password)) {
    return res.status(403).json({ error: 'Invalid password' });
  }
  return res.json({ success: true });
}

export async function listSalaries(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const items = await EmployeeSalary.find(filter)
      .populate('userId', 'name email')
      .populate('companyId', 'name')
      .sort({ updatedAt: -1 });
    return res.json({ salaries: items.map(salaryToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list salaries' });
  }
}

export async function upsertSalary(req, res) {
  try {
    const { userId, monthlySalary, currency, effectiveFrom, notes, companyId } = req.body;
    if (!userId || monthlySalary == null) {
      return res.status(400).json({ error: 'userId and monthlySalary are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const employee = await User.findById(userId);
    if (!employee) return res.status(404).json({ error: 'User not found' });

    let item = await EmployeeSalary.findOne({ userId, companyId: company._id });
    if (item) {
      item.monthlySalary = Math.round(monthlySalary);
      item.currency = currency || company.salaryCurrency || 'INR';
      item.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : item.effectiveFrom;
      item.notes = notes ?? item.notes;
      item.updatedBy = req.user._id;
      await item.save();
    } else {
      item = await EmployeeSalary.create({
        userId,
        companyId: company._id,
        monthlySalary: Math.round(monthlySalary),
        currency: currency || company.salaryCurrency || 'INR',
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        notes: notes || '',
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
    }

    const populated = await EmployeeSalary.findById(item._id).populate('userId', 'name email');
    return res.json({ salary: salaryToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save salary' });
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
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const items = await EmployeeLeave.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    return res.json({ leaves: items.map(leaveToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list leaves' });
  }
}

export async function createLeave(req, res) {
  try {
    const { userId, leaveType, startDate, endDate, days, reason, companyId } = req.body;
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: 'userId, startDate, and endDate are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const item = await EmployeeLeave.create({
      userId,
      companyId: targetCompanyId,
      leaveType: leaveType || 'casual',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: days || 1,
      reason: reason || '',
      createdBy: req.user._id,
    });

    const populated = await EmployeeLeave.findById(item._id).populate('userId', 'name email');
    return res.status(201).json({ leave: leaveToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create leave' });
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
    const populated = await EmployeeLeave.findById(item._id).populate('userId', 'name email');
    return res.json({ leave: leaveToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update leave' });
  }
}
