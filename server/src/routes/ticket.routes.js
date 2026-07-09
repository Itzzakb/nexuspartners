import { Router } from 'express';
import {
  listTickets,
  getTicketStats,
  getTicketDashboard,
  getTicket,
  createTicket,
  createExternalTicket,
  updateTicket,
  changeStage,
  assignTicket,
  addNote,
  addResumeFile,
  deleteTicket,
  getResumeTeam,
} from '../controllers/ticket.controller.js';
import {
  enableFormEditAuth,
  getFormShareLink,
} from '../controllers/resumeForm.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// External API — no JWT, uses x-api-secret
router.post('/external', createExternalTicket);

router.use(authenticate);

router.get('/stats', getTicketStats);
router.get('/dashboard', getTicketDashboard);
router.get('/resume-team', getResumeTeam);
router.get('/', listTickets);
router.post('/', createTicket);
router.get('/:id', getTicket);
router.patch('/:id', updateTicket);
router.post('/:id/enable-form-edit', enableFormEditAuth);
router.post('/:id/form-share-link', getFormShareLink);
router.post('/:id/stage', changeStage);
router.post('/:id/assign', assignTicket);
router.post('/:id/notes', addNote);
router.post('/:id/files', addResumeFile);
router.delete('/:id', deleteTicket);

export default router;
