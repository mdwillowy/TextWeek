import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid token',
      });
    }

    req.authUser = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      code: 'AUTH_EXPIRED',
      message: 'Invalid or expired token',
    });
  }
}
