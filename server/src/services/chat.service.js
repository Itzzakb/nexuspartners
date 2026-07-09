import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

export function conversationToJSON(doc, currentUserId) {
  const o = doc.toObject ? doc.toObject() : doc;
  const participants = (o.participantIds || []).map((p) => ({
    id: p._id?.toString?.() ?? p.id ?? p.toString(),
    name: p.name ?? '',
    email: p.email ?? '',
  }));
  return {
    id: o._id.toString(),
    companyId: o.companyId?.toString?.() ?? o.companyId,
    type: o.type,
    title: o.title,
    participants,
    lastMessageAt: o.lastMessageAt,
    lastMessagePreview: o.lastMessagePreview,
    isCrossCompany: o.isCrossCompany,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    unread: false,
    currentUserId,
  };
}

export function messageToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    conversationId: o.conversationId?.toString?.() ?? o.conversationId,
    senderId: o.senderId?._id?.toString?.() ?? o.senderId?.toString?.() ?? o.senderId,
    senderName: o.senderId?.name ?? '',
    text: o.text,
    imageUrl: o.imageUrl,
    readBy: (o.readBy || []).map((id) => id.toString()),
    createdAt: o.createdAt,
  };
}

export async function findOrCreateDirectConversation(userA, userB) {
  const existing = await Conversation.findOne({
    type: 'direct',
    participantIds: { $all: [userA._id, userB._id], $size: 2 },
  });
  if (existing) return existing;

  const isCrossCompany = userA.companyId.toString() !== userB.companyId.toString();
  return Conversation.create({
    companyId: userA.companyId,
    participantIds: [userA._id, userB._id],
    type: 'direct',
    isCrossCompany,
    createdBy: userA._id,
  });
}

export async function getConversationForUser(conversationId, userId) {
  const conv = await Conversation.findById(conversationId).populate('participantIds', 'name email companyId');
  if (!conv) return null;
  const isParticipant = conv.participantIds.some((p) => p._id.toString() === userId.toString());
  if (!isParticipant) return null;
  return conv;
}

export async function listConversationsForUser(user) {
  const convs = await Conversation.find({ participantIds: user._id })
    .populate('participantIds', 'name email')
    .sort({ lastMessageAt: -1, updatedAt: -1 });
  return convs;
}

export async function createMessage(conversationId, senderId, payload) {
  const message = await Message.create({
    conversationId,
    senderId,
    text: payload.text || '',
    imageUrl: payload.imageUrl || '',
    imagePublicId: payload.imagePublicId || '',
    readBy: [senderId],
  });

  const preview = payload.text || (payload.imageUrl ? '📷 Image' : '');
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessageAt: new Date(),
    lastMessagePreview: preview.slice(0, 120),
  });

  return Message.findById(message._id).populate('senderId', 'name email');
}

export async function searchUsersForChat(user, query, companyId) {
  let filter = { isActive: true, _id: { $ne: user._id } };
  if (user.isPlatformAdmin && companyId) {
    filter.companyId = companyId;
  } else if (!user.isPlatformAdmin) {
    filter.companyId = user.companyId._id;
  }
  if (query) {
    filter.$or = [
      { name: new RegExp(query, 'i') },
      { email: new RegExp(query, 'i') },
    ];
  }
  const users = await User.find(filter).select('name email companyId').limit(20);
  return users;
}
