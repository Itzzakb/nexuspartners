import jwt from 'jsonwebtoken';
import RecruiterAccount from '../models/RecruiterAccount.js';
import Company from '../models/Company.js';

export function signRecruiterAccessToken(recruiter) {
  return jwt.sign(
    {
      sub: recruiter._id.toString(),
      username: recruiter.username,
      companyId: recruiter.companyId.toString(),
      type: 'recruiter',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.RECRUITER_JWT_EXPIRES_IN || '12h' }
  );
}

export async function authenticateRecruiter(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.type !== 'recruiter') {
      return res.status(401).json({ error: 'Invalid recruiter token' });
    }

    const recruiter = await RecruiterAccount.findById(payload.sub);
    if (!recruiter || !recruiter.isActive) {
      return res.status(401).json({ error: 'Recruiter account not found or inactive' });
    }

    const company = await Company.findById(recruiter.companyId);
    if (!company) {
      return res.status(401).json({ error: 'Company not found' });
    }

    req.recruiter = recruiter;
    req.company = company;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
