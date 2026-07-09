import { Router } from 'express';
import {
  register,
  login,
  logout,
  refresh,
  me,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, me);

export default router;
