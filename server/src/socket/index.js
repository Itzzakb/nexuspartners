import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function setupSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).populate('companyId');
      if (!user || !user.isActive) return next(new Error('Unauthorized'));

      socket.user = user;
      socket.companyId = user.companyId._id.toString();
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`company:${socket.companyId}`);
    if (socket.user.isPlatformAdmin) {
      socket.join('platform:admin');
    }

    socket.on('join:ticket', (ticketId) => {
      if (ticketId) socket.join(`ticket:${ticketId}`);
    });

    socket.on('leave:ticket', (ticketId) => {
      if (ticketId) socket.leave(`ticket:${ticketId}`);
    });

    socket.on('join:conversation', (conversationId) => {
      if (conversationId) socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId) => {
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on('chat:typing', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('chat:typing', {
          conversationId,
          userId: socket.user._id.toString(),
          userName: socket.user.name,
        });
      }
    });

    socket.on('disconnect', () => {});
  });
}
