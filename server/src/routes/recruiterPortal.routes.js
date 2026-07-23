import { Router } from 'express';
import {
  recruiterLogin,
  recruiterMe,
  listStudents,
  getStudent,
  getStudentActivity,
  getStudentResumeForm,
  updateStudentNotes,
  listJobs,
  getJob,
  dropJob,
  applyJob,
  listApplications,
  getApplication,
  updateApplicationStatus,
  listApplicationStatuses,
  listStudentTickets,
  listResumeTemplates,
  downloadStudentResumeHandler,
  fixResume,
  downloadAtsResume,
  listResumeLibraryHandler,
  getResumeLibraryHandler,
  refreshResumeLibraryHandler,
  deleteResumeLibraryHandler,
  getDashboard,
  getAnalytics,
  searchAll,
  listInterviews,
  updateSettings,
  changePassword,
  listNotifications,
} from '../controllers/recruiterPortal.controller.js';
import { authenticateRecruiter } from '../middleware/recruiterAuth.js';

const router = Router();

router.post('/auth/login', recruiterLogin);

router.use(authenticateRecruiter);

router.get('/auth/me', recruiterMe);
router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);
router.get('/search', searchAll);
router.get('/notifications', listNotifications);

router.get('/students', listStudents);
router.get('/students/:phone', getStudent);
router.get('/students/:phone/activity', getStudentActivity);
router.get('/students/:phone/resume-form', getStudentResumeForm);
router.patch('/students/:phone/notes', updateStudentNotes);
router.get('/students/:phone/tickets', listStudentTickets);
router.get('/students/:phone/resume/download', downloadStudentResumeHandler);

router.get('/resume-templates', listResumeTemplates);
router.get('/resume-library', listResumeLibraryHandler);
router.get('/resume-library/:id', getResumeLibraryHandler);
router.post('/resume-library/:id/refresh', refreshResumeLibraryHandler);
router.delete('/resume-library/:id', deleteResumeLibraryHandler);

router.get('/applications', listApplications);
router.get('/applications/statuses', listApplicationStatuses);
router.get('/applications/:id', getApplication);
router.patch('/applications/:id/status', updateApplicationStatus);

router.get('/interviews', listInterviews);

router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/drop', dropJob);
router.post('/jobs/:id/apply', applyJob);
router.post('/jobs/:id/fix-resume', fixResume);
router.post('/jobs/:id/download-ats-resume', downloadAtsResume);

router.patch('/settings', updateSettings);
router.post('/settings/password', changePassword);

export default router;
