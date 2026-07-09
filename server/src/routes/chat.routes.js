import { Router } from 'express';
import {
  listConversations,
  startConversation,
  getMessages,
  sendMessage,
  markRead,
  searchChatUsers,
} from '../controllers/chat.controller.js';
import { authenticate, requireModule } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModule('chat'));

router.get('/conversations', listConversations);
router.post('/conversations', startConversation);
router.get('/users', searchChatUsers);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/read', markRead);

export default router;
