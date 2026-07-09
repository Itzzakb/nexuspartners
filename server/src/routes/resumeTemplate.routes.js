import { Router } from 'express';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/resumeTemplate.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('ats'));

router.get('/', listTemplates);
router.post('/', createTemplate);
router.patch('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
