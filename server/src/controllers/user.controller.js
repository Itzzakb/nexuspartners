import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Company from '../models/Company.js';

const SALT_ROUNDS = 12;

export async function listUsers(req, res) {
  try {
    let filter = {};

    if (req.user.isPlatformAdmin) {
      const { companyId } = req.query;
      if (companyId) {
        filter.companyId = companyId;
      }
    } else {
      filter.companyId = req.user.companyId._id;
    }

    const users = await User.find(filter)
      .populate('companyId', 'name slug')
      .sort({ createdAt: -1 });

    return res.json({
      users: users.map((u) => ({
        ...u.toSafeJSON(),
        companyName: u.companyId?.name,
      })),
    });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'Failed to list users' });
  }
}

export async function createUser(req, res) {
  try {
    const { email, password, name, phone, role, companyId, isCompanyAdmin } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    let targetCompanyId = req.user.companyId._id;

    if (req.user.isPlatformAdmin && companyId) {
      targetCompanyId = companyId;
    }

    const company = await Company.findById(targetCompanyId);
    if (!company) {
      return res.status(400).json({ error: 'Invalid company' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      phone: phone || '',
      role: role || 'mentor',
      companyId: company._id,
      isActive: true,
      isCompanyAdmin: !!isCompanyAdmin,
      isPlatformAdmin: false,
      createdBy: req.user._id,
    });

    return res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req, res) {
  try {
    const user = await User.findById(req.params.id).populate('companyId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canManage =
      req.user.isPlatformAdmin ||
      (req.user.isCompanyAdmin && user.companyId._id.toString() === req.user.companyId._id.toString());

    if (!canManage) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, phone, role, isActive, isCompanyAdmin } = req.body;

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    if (isCompanyAdmin !== undefined && !user.isPlatformAdmin) {
      user.isCompanyAdmin = isCompanyAdmin;
    }

    await user.save();

    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function sendPasswordReset(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canManage =
      req.user.isPlatformAdmin ||
      (req.user.isCompanyAdmin && user.companyId.toString() === req.user.companyId._id.toString());

    if (!canManage) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.body.email = user.email;
    const { forgotPassword } = await import('./auth.controller.js');
    return forgotPassword(req, res);
  } catch (err) {
    console.error('Send reset error:', err);
    return res.status(500).json({ error: 'Failed to send reset link' });
  }
}
