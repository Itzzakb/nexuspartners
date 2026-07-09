import { Router } from 'express';
import {
  listPublicCompanies,
  listAllCompanies,
  createCompany,
  getCompany,
  updateCompany,
  getMyCompanySettings,
  updateMyCompanySettings,
} from '../controllers/company.controller.js';
import { authenticate, requirePlatformAdmin, requireCompanyAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/public', listPublicCompanies);

router.use(authenticate);

router.get('/me', getMyCompanySettings);
router.patch('/me', requireCompanyAdmin, updateMyCompanySettings);

router.get('/', requirePlatformAdmin, listAllCompanies);
router.post('/', requirePlatformAdmin, createCompany);
router.get('/:id', getCompany);
router.patch('/:id', requireCompanyAdmin, updateCompany);

export default router;
