import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

export async function authenticateSocket(socket, next) {
  try {
    const authHeader = socket.handshake?.auth?.token || socket.handshake?.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!token) {
      return next(new Error('Unauthorized: missing token'));
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      return next(new Error('Unauthorized: user not found'));
    }

    socket.authUser = user;
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
}
