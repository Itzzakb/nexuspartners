import { Router } from 'express';
import { getSharedFormView } from '../controllers/resumeForm.controller.js';

const router = Router();

router.get('/:token', getSharedFormView);

export default router;
