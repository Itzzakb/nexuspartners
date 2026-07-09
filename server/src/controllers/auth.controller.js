import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Company from '../models/Company.js';
import RefreshToken from '../models/RefreshToken.js';
import {
  signAccessToken,
  signRefreshToken,
} from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/sendgrid.service.js';

const SALT_ROUNDS = 12;

function parseDurationToMs(duration) {
  const match = String(duration).match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return value * multipliers[unit];
}

export async function register(req, res) {
  try {
    const { email, password, name, phone, role, companyId } = req.body;

    if (!email || !password || !name || !companyId) {
      return res.status(400).json({ error: 'Email, password, name, and company are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(400).json({ error: 'Invalid company selected' });
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
      isCompanyAdmin: false,
      isPlatformAdmin: false,
    });

  const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const expiresAt = new Date(Date.now() + parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d'));

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    return res.status(201).json({
      user: user.toSafeJSON(),
      company: {
        id: company._id.toString(),
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl,
        appTitle: company.appTitle,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        faviconUrl: company.faviconUrl,
        isPlatformAdmin: company.isPlatformAdmin,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).populate('companyId');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive. Contact your administrator.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const expiresAt = new Date(Date.now() + parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d'));

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    const company = user.companyId;

    return res.json({
      user: user.toSafeJSON(),
      company: {
        id: company._id.toString(),
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl,
        appTitle: company.appTitle,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        faviconUrl: company.faviconUrl,
        isPlatformAdmin: company.isPlatformAdmin,
        website: company.website,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(stored.userId).populate('companyId');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const accessToken = signAccessToken(user);

    return res.json({ accessToken, user: user.toSafeJSON() });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
}

export async function me(req, res) {
  const company = req.company;
  return res.json({
    user: req.user.toSafeJSON(),
    company: {
      id: company._id.toString(),
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      faviconUrl: company.faviconUrl,
      appTitle: company.appTitle,
      primaryColor: company.primaryColor,
      secondaryColor: company.secondaryColor,
      isPlatformAdmin: company.isPlatformAdmin,
      website: company.website,
      owners: company.owners,
      documents: company.documents,
      razorpay: company.razorpay,
      billRatePerDay: company.billRatePerDay,
      salaryCurrency: company.salaryCurrency,
      createStudentPassword: company.createStudentPassword,
    },
  });
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}
