import { io } from 'socket.io-client';

let socketInstance = null;

function socketBaseUrl() {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (apiBase) {
    return apiBase.replace(/\/api\/?$/, '');
  }

  return import.meta.env.DEV ? 'http://localhost:5050' : '';
}

export function connectSocket(accessToken) {
  if (!accessToken) {
    return null;
  }

  if (socketInstance?.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.auth = { token: `Bearer ${accessToken}` };
    socketInstance.connect();
    return socketInstance;
  }

  socketInstance = io(socketBaseUrl(), {
    autoConnect: true,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: {
      token: `Bearer ${accessToken}`,
    },
  });

  return socketInstance;
}

export function updateSocketToken(accessToken) {
  if (!socketInstance) return;
  socketInstance.auth = {
    token: accessToken ? `Bearer ${accessToken}` : '',
  };
}

export function disconnectSocket() {
  if (!socketInstance) return;
  socketInstance.disconnect();
}

export function getSocket() {
  return socketInstance;
}
