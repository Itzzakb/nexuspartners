import { Router } from 'express';
import { parseResume } from '../controllers/resumeForm.controller.js';
import { buildResume, updateResume } from '../controllers/resume.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.post('/parse', parseResume);
router.post('/build-download', buildResume);
router.post('/update-student', updateResume);

export default router;
