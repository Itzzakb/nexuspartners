import { Router } from 'express';
import {
  listPlacements,
  getPlacement,
  createPlacement,
  updatePlacement,
  deletePlacement,
} from '../controllers/placement.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', listPlacements);
router.post('/', createPlacement);
router.get('/:id', getPlacement);
router.patch('/:id', updatePlacement);
router.delete('/:id', deletePlacement);

export default router;
