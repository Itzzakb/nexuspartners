import { Router } from 'express';
import { parseResume } from '../controllers/resumeForm.controller.js';
import {
  buildResume,
  updateResume,
  downloadResumeFile,
  importStudentResume,
  resumeImportUpload,
} from '../controllers/resume.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Short-lived token download — no auth (token is the credential)
router.get('/download/:token', downloadResumeFile);

router.use(authenticate);
router.post('/parse', parseResume);
router.post('/build-download', buildResume);
router.post('/update-student', updateResume);
router.post('/import-student', resumeImportUpload, importStudentResume);

export default router;
