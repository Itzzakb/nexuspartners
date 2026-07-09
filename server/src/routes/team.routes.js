import { Router } from 'express';
import {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  getMyTeam,
  getTeamMemberStudents,
  searchCompanyUsers,
} from '../controllers/team.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/my', getMyTeam);
router.get('/users', searchCompanyUsers);
router.get('/', listTeams);
router.post('/', createTeam);
router.get('/:id', getTeam);
router.patch('/:id', updateTeam);
router.get('/:id/members/:username/students', getTeamMemberStudents);

export default router;
