import User from '../models/User.js';
import {
  listConversationsForUser,
  getConversationForUser,
  findOrCreateDirectConversation,
  createMessage,
  conversationToJSON,
  messageToJSON,
  searchUsersForChat,
} from '../services/chat.service.js';
import { emitChatEvent } from '../services/socket.service.js';

export async function listConversations(req, res) {
  try {
    const convs = await listConversationsForUser(req.user);
    return res.json({
      conversations: convs.map((c) => conversationToJSON(c, req.user._id.toString())),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
}

export async function startConversation(req, res) {
  try {
    const { participantId, title, participantIds } = req.body;

    if (participantIds?.length) {
      const ids = [...new Set([req.user._id.toString(), ...participantIds])];
      const { default: Conversation } = await import('../models/Conversation.js');
      const conv = await Conversation.create({
        companyId: req.user.companyId._id,
        participantIds: ids,
        type: 'group',
        title: title || 'Group chat',
        createdBy: req.user._id,
      });
      const populated = await conv.populate('participantIds', 'name email');
      return res.status(201).json({ conversation: conversationToJSON(populated, req.user._id.toString()) });
    }

    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }

    const other = await User.findById(participantId);
    if (!other || !other.isActive) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.user.isPlatformAdmin && other.companyId.toString() !== req.user.companyId._id.toString()) {
      return res.status(403).json({ error: 'Cross-company chat requires platform admin' });
    }

    const conv = await findOrCreateDirectConversation(req.user, other);
    const populated = await conv.populate('participantIds', 'name email');
    return res.status(201).json({ conversation: conversationToJSON(populated, req.user._id.toString()) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to start conversation' });
  }
}

export async function getMessages(req, res) {
  try {
    const conv = await getConversationForUser(req.params.id, req.user._id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const { default: Message } = await import('../models/Message.js');
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const messages = await Message.find({ conversationId: conv._id })
      .populate('senderId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      messages: messages.reverse().map(messageToJSON),
      conversation: conversationToJSON(conv, req.user._id.toString()),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get messages' });
  }
}

export async function sendMessage(req, res) {
  try {
    const conv = await getConversationForUser(req.params.id, req.user._id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const { text, imageUrl, imagePublicId } = req.body;
    if (!text && !imageUrl) {
      return res.status(400).json({ error: 'Message text or image is required' });
    }

    const message = await createMessage(conv._id, req.user._id, { text, imageUrl, imagePublicId });
    const json = messageToJSON(message);

    emitChatEvent(conv._id.toString(), 'chat:message', { message: json, conversationId: conv._id.toString() });

    return res.status(201).json({ message: json });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

export async function markRead(req, res) {
  try {
    const conv = await getConversationForUser(req.params.id, req.user._id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const { default: Message } = await import('../models/Message.js');
    await Message.updateMany(
      { conversationId: conv._id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    emitChatEvent(conv._id.toString(), 'chat:read', { conversationId: conv._id.toString(), userId: req.user._id.toString() });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark read' });
  }
}

export async function searchChatUsers(req, res) {
  try {
    const users = await searchUsersForChat(req.user, req.query.q, req.query.companyId);
    return res.json({
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        companyId: u.companyId?.toString(),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to search users' });
  }
}
