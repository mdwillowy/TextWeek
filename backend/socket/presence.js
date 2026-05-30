import { User } from '../models/User.js';
import { env } from '../config/env.js';

const userSockets = new Map();
const offlineTimers = new Map();

function roomName(userId) {
  return `user:${userId}`;
}

function clearOfflineTimer(userId) {
  const timer = offlineTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    offlineTimers.delete(userId);
  }
}

export function getOnlineState(userId) {
  const sockets = userSockets.get(String(userId));
  return Boolean(sockets && sockets.size > 0);
}

export async function registerSocketPresence(io, socket) {
  const userId = String(socket.authUser._id);
  const socketId = socket.id;
  const showOnlineStatus = env.featureOnlineStatus && (socket.authUser?.settings?.showOnlineStatus ?? true);

  clearOfflineTimer(userId);

  const currentSet = userSockets.get(userId) || new Set();
  const wasOffline = currentSet.size === 0;
  currentSet.add(socketId);
  userSockets.set(userId, currentSet);

  socket.join(roomName(userId));

  if (wasOffline) {
    await User.updateOne(
      { _id: userId },
      { $set: { isOnline: true, lastSeen: new Date() } }
    );

    if (showOnlineStatus) {
      io.emit('presence:update', {
        userId,
        online: true,
        lastSeen: new Date().toISOString(),
      });
    }
  }
}

export function scheduleOffline(io, socket, delayMs = 0) {
  const userId = String(socket.authUser._id);
  const socketId = socket.id;
  const showOnlineStatus = env.featureOnlineStatus && (socket.authUser?.settings?.showOnlineStatus ?? true);

  const set = userSockets.get(userId);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      userSockets.delete(userId);
    }
  }

  if (set && set.size > 0) {
    return;
  }

  clearOfflineTimer(userId);

  const runOfflineUpdate = async () => {
    const online = getOnlineState(userId);
    if (online) {
      return;
    }

    const lastSeen = new Date();
    await User.updateOne(
      { _id: userId },
      { $set: { isOnline: false, lastSeen } }
    );

    if (showOnlineStatus) {
      io.emit('presence:update', {
        userId,
        online: false,
        lastSeen: lastSeen.toISOString(),
      });
    }
  };

  if (delayMs <= 0) {
    runOfflineUpdate().catch(() => {});
    return;
  }

  const timer = setTimeout(() => {
    runOfflineUpdate().finally(() => {
      offlineTimers.delete(userId);
    });
  }, delayMs);

  offlineTimers.set(userId, timer);
}

export function userRoom(userId) {
  return roomName(userId);
}
