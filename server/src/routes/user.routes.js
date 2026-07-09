import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  sendPasswordReset,
} from '../controllers/user.controller.js';
import { authenticate, requireCompanyAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireCompanyAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/:id/send-reset', sendPasswordReset);

export default router;
