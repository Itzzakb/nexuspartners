import { Router } from 'express';
import {
  getPublicForm,
  savePublicForm,
  getSharedFormView,
} from '../controllers/resumeForm.controller.js';

const router = Router();

router.get('/:ticketId', getPublicForm);
router.put('/:ticketId', savePublicForm);

export default router;
