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
} from '../controllers/student.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('students'));

router.get('/', listStudents);
router.post('/', createStudentRecord);
router.get('/lookup', lookupStudentByPhone);
router.get('/ticket/:ticketId/profile', getTicketStudentProfile);
router.post('/ticket/:ticketId/create', createStudentFromTicket);
router.get('/:phone', getStudent);
router.patch('/:phone', updateStudent);
router.patch('/:phone/notes', updateStudentNotes);

export default router;
