import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      companyId: user.companyId.toString(),
      role: user.role,
      isCompanyAdmin: user.isCompanyAdmin,
      isPlatformAdmin: user.isPlatformAdmin,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.sub).populate('companyId');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive. Contact your administrator.' });
    }

    req.user = user;
    req.company = user.companyId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireCompanyAdmin(req, res, next) {
  if (req.user.isPlatformAdmin || req.user.isCompanyAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Company admin access required' });
}

export function requirePlatformAdmin(req, res, next) {
  if (req.user.isPlatformAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Platform admin access required' });
}

export async function requireSameCompanyOrPlatform(req, res, next) {
  const targetCompanyId = req.params.companyId || req.body.companyId;
  if (req.user.isPlatformAdmin) {
    return next();
  }
  if (targetCompanyId && targetCompanyId !== req.user.companyId._id.toString()) {
    return res.status(403).json({ error: 'Access denied for this company' });
  }
  next();
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function getPlatformCompany() {
  return Company.findOne({ isPlatformAdmin: true });
}

export function userHasModuleAccess(user, moduleName) {
  if (!user) return false;
  if (user.isPlatformAdmin || user.isCompanyAdmin) return true;
  const perms = user.modulePermissions;
  const entries = perms instanceof Map ? [...perms.entries()] : Object.entries(perms || {});
  const hasAny = entries.some(([, v]) => v === true);
  if (!hasAny) {
    return ['tickets', 'chat', 'interviews', 'placements', 'students'].includes(moduleName);
  }
  if (perms instanceof Map) return !!perms.get(moduleName);
  return !!perms[moduleName];
}

export function requireModule(moduleName) {
  return (req, res, next) => {
    if (userHasModuleAccess(req.user, moduleName)) return next();
    return res.status(403).json({ error: `Access denied: ${moduleName} module required` });
  };
}

export function verifySalariesPassword(password) {
  const expected = process.env.SALARIES_PASSWORD || 'Saibaba@2026';
  return password === expected;
}

export function requireSalariesPassword(req, res, next) {
  const { password } = req.body;
  if (!verifySalariesPassword(password)) {
    return res.status(403).json({ error: 'Invalid salaries password' });
  }
  next();
}
