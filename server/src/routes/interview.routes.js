import { Router } from 'express';
import {
  listInterviews,
  getInterviewStats,
  getInterview,
  createInterview,
  updateInterview,
  bulkInterviewAction,
  deleteInterview,
  getSharedInterview,
} from '../controllers/interview.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/share/:token', getSharedInterview);

router.use(authenticate);

router.get('/stats', getInterviewStats);
router.get('/', listInterviews);
router.post('/', createInterview);
router.post('/bulk', bulkInterviewAction);
router.get('/:id', getInterview);
router.patch('/:id', updateInterview);
router.delete('/:id', deleteInterview);

export default router;
