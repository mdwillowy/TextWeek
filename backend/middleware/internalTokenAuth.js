import { env } from '../config/env.js';

export function requireInternalToken(req, res, next) {
  if (!env.internalJobToken) {
    return res.status(503).json({
      success: false,
      message: 'Internal job token is not configured',
    });
  }

  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || token !== env.internalJobToken) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized internal operation',
    });
  }

  next();
}
