import { Router } from 'express';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  updateUserPermissions,
  getModuleKeys,
} from '../controllers/permission.controller.js';
import { authenticate, requireCompanyAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireCompanyAdmin);

router.get('/modules', getModuleKeys);
router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.patch('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);
router.patch('/users/:id', updateUserPermissions);

export default router;
