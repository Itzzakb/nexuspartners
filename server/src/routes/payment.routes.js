import { Router } from 'express';
import {
  listPayments,
  getPaymentStats,
  createManualPayment,
  listPaymentLinks,
  getPaymentLink,
  createPaymentLink,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  simulateMockPayment,
} from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/mock/:mockId/pay', simulateMockPayment);

router.get('/stats', getPaymentStats);
router.get('/', listPayments);
router.post('/manual', createManualPayment);

router.get('/links', listPaymentLinks);
router.post('/razorpay/link', createPaymentLink);
router.get('/links/:id', getPaymentLink);

router.get('/subscriptions', listSubscriptions);
router.post('/subscriptions', createSubscription);
router.patch('/subscriptions/:id', updateSubscription);

export default router;
