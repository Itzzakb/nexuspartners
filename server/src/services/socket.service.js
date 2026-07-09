let io = null;

export function setIO(socketIO) {
  io = socketIO;
}

export function getIO() {
  return io;
}

export function emitTicketEvent(companyId, event, payload) {
  if (!io) return;
  io.to(`company:${companyId}`).emit(event, payload);
  if (payload?.ticket?.id) {
    io.to(`ticket:${payload.ticket.id}`).emit(event, payload);
  }
}

export function emitChatEvent(conversationId, event, payload) {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
}
