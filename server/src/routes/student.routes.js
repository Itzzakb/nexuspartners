import { Router } from 'express';
import {
  listStudents,
  lookupStudentByPhone,
  getStudent,
  getTicketStudentProfile,
  createStudentFromTicket,
  createStudentRecord,
  updateStudentNotes,
  updateStudent,
  getStudentShareLink,
  getSharedStudent,
  listJobRoles,
  listJobCountries,
} from '../controllers/student.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

/** Public read-only student share page (no auth). */
router.get('/share/:token', getSharedStudent);

router.use(authenticate);
router.use(requireModule('students'));

router.get('/', listStudents);
router.post('/', createStudentRecord);
router.get('/job-roles', listJobRoles);
router.get('/job-countries', listJobCountries);
router.get('/lookup', lookupStudentByPhone);
router.get('/ticket/:ticketId/profile', getTicketStudentProfile);
router.post('/ticket/:ticketId/create', createStudentFromTicket);
router.get('/:phone/share-link', getStudentShareLink);
router.post('/:phone/share-link', getStudentShareLink);
router.get('/:phone', getStudent);
router.patch('/:phone', updateStudent);
router.patch('/:phone/notes', updateStudentNotes);

export default router;
