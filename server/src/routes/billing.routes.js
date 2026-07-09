import { Router } from 'express';
import {
  listBilling,
  previewBilling,
  generateBilling,
  updateBillingRecord,
  getBillingBatches,
} from '../controllers/billing.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('billing'));

router.get('/', listBilling);
router.get('/preview', previewBilling);
router.get('/batches', getBillingBatches);
router.post('/generate', generateBilling);
router.patch('/:id', updateBillingRecord);

export default router;
