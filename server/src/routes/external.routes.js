import { Router } from 'express';
import {
  proxyStudents,
  proxyCompanyMembers,
  getRecruiter,
  proxyStudentDetails,
  proxyJobRoles,
  createRecruiter,
  updateRecruiter,
} from '../controllers/external.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/students', proxyStudents);
router.post('/student-details', proxyStudentDetails);
router.get('/job-roles', proxyJobRoles);
router.post('/recruiters', proxyCompanyMembers);
router.get('/recruiters/:username', getRecruiter);
router.post('/recruiters/create', createRecruiter);
router.post('/recruiters/update', updateRecruiter);

export default router;
