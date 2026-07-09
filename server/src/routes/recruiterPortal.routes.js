import { Router } from 'express';
import {
  recruiterLogin,
  recruiterMe,
  listStudents,
  getStudent,
  getStudentActivity,
  updateStudentNotes,
  listJobs,
  getJob,
  dropJob,
  applyJob,
  listStudentTickets,
  listResumeTemplates,
  downloadStudentResumeHandler,
  fixResume,
  downloadAtsResume,
} from '../controllers/recruiterPortal.controller.js';
import { authenticateRecruiter } from '../middleware/recruiterAuth.js';

const router = Router();

router.post('/auth/login', recruiterLogin);

router.use(authenticateRecruiter);

router.get('/auth/me', recruiterMe);
router.get('/students', listStudents);
router.get('/students/:phone', getStudent);
router.get('/students/:phone/activity', getStudentActivity);
router.patch('/students/:phone/notes', updateStudentNotes);
router.get('/students/:phone/tickets', listStudentTickets);
router.get('/students/:phone/resume/download', downloadStudentResumeHandler);

router.get('/resume-templates', listResumeTemplates);

router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/drop', dropJob);
router.post('/jobs/:id/apply', applyJob);
router.post('/jobs/:id/fix-resume', fixResume);
router.post('/jobs/:id/download-ats-resume', downloadAtsResume);

export default router;
