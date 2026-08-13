import { Router } from 'express';
import { parseResume } from '../controllers/resumeForm.controller.js';
import {
  buildResume,
  updateResume,
  downloadResumeFile,
  importStudentResume,
  resumeImportUpload,
  listAppliedResumes,
  downloadAppliedResume,
} from '../controllers/resume.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

// Short-lived token download — no auth (token is the credential)
router.get('/download/:token', downloadResumeFile);

router.use(authenticate);
router.post('/parse', parseResume);
router.post('/build-download', buildResume);
router.post('/update-student', updateResume);
router.post('/import-student', resumeImportUpload, importStudentResume);

router.get('/applied', requireModule('ats'), listAppliedResumes);
router.post('/applied/:id/download', requireModule('ats'), downloadAppliedResume);

export default router;
