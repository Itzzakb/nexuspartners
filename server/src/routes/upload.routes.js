import { Router } from 'express';
import { uploadFile, uploadMiddleware } from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.post('/', uploadMiddleware, uploadFile);

export default router;
