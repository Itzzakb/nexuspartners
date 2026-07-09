import { Router } from 'express';
import {
  listStudents,
  getStudent,
  createStudentRecord,
  updateStudentNotes,
} from '../controllers/student.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('students'));

router.get('/', listStudents);
router.post('/', createStudentRecord);
router.get('/:phone', getStudent);
router.patch('/:phone/notes', updateStudentNotes);

export default router;
