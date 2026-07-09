import { Router } from 'express';
import { listPrompts, updatePrompt } from '../controllers/prompt.controller.js';
import { authenticate, requirePlatformAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatformAdmin);

router.get('/', listPrompts);
router.patch('/:key', updatePrompt);

export default router;
