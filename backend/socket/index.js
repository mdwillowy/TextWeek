import { Server } from 'socket.io';
import { authenticateSocket } from './auth.js';
import { registerChatEvents } from './chatEvents.js';
import { registerSocketPresence, scheduleOffline, userRoom } from './presence.js';
import { env } from '../config/env.js';

let ioInstance;

function chatRoom(chatId) {
  return `chat:${chatId}`;
}

export function joinUserRoom(socket, userId) {
  socket.join(userRoom(userId));
}

export function joinChatRoom(socket, chatId) {
  socket.join(chatRoom(chatId));
}

export function initSocketServer(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }

        if (env.socketOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Socket CORS blocked'));
      },
      credentials: true,
    },
  });

  ioInstance.use(authenticateSocket);

  ioInstance.on('connection', async (socket) => {
    try {
      const userId = String(socket.authUser._id);

      await registerSocketPresence(ioInstance, socket);
      joinUserRoom(socket, userId);

      registerChatEvents({
        io: ioInstance,
        socket,
        emitToUser,
        emitToChat,
      });

      socket.on('disconnect', () => {
        scheduleOffline(ioInstance, socket);
      });
    } catch (err) {
      console.error('[socket:connection]', err?.message || err);
      socket.emit('error:event', {
        event: 'connection',
        message: 'Socket initialization failed',
      });
      socket.disconnect(true);
    }
  });

  return ioInstance;
}

export function emitToUser(userId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(userRoom(userId)).emit(event, payload);
}

export function emitToChat(chatId, event, payload, exceptUserId = null) {
  if (!ioInstance) return;

  if (!exceptUserId) {
    ioInstance.to(chatRoom(chatId)).emit(event, payload);
    return;
  }

  const room = ioInstance.sockets.adapter.rooms.get(chatRoom(chatId));
  if (!room) {
    return;
  }

  for (const socketId of room) {
    const targetSocket = ioInstance.sockets.sockets.get(socketId);
    if (!targetSocket) continue;
    if (String(targetSocket.authUser?._id) === String(exceptUserId)) continue;
    targetSocket.emit(event, payload);
  }
}

export function getIO() {
  return ioInstance;
}
