import { Router } from 'express';
import {
  listMasterItems,
  createMasterItem,
  updateMasterItem,
  deleteMasterItem,
} from '../controllers/jobScrapMaster.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('job_scrap_master'));

router.get('/', listMasterItems);
router.post('/', createMasterItem);
router.patch('/:id', updateMasterItem);
router.delete('/:id', deleteMasterItem);

export default router;
