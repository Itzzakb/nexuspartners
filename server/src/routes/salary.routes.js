import { Router } from 'express';
import {
  verifyPassword,
  listSalaries,
  upsertSalary,
  deleteSalary,
  listLeaves,
  createLeave,
  updateLeave,
} from '../controllers/salary.controller.js';
import { authenticate, requireModule, requireSalariesPassword } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('salaries'));

router.post('/verify-password', verifyPassword);
router.get('/', listSalaries);
router.post('/', requireSalariesPassword, upsertSalary);
router.delete('/:id', requireSalariesPassword, deleteSalary);
router.get('/leaves', listLeaves);
router.post('/leaves', createLeave);
router.patch('/leaves/:id', updateLeave);

export default router;
