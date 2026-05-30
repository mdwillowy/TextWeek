import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    requestId: req.requestId,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err.message?.startsWith('CORS blocked for origin:')) {
    return res.status(403).json({
      success: false,
      requestId: req.requestId,
      code: 'CORS_ORIGIN_BLOCKED',
      message: 'Origin is not allowed by CORS policy',
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    const isAvatarUpload = req.originalUrl?.includes('/users/me/avatar');
    const uploadLimitMessage = isAvatarUpload ? 'Avatar file must be 2MB or smaller' : 'Image file must be 2MB or smaller';

    return res.status(400).json({
      success: false,
      requestId: req.requestId,
      code: 'FILE_TOO_LARGE',
      message: uploadLimitMessage,
    });
  }

  const status = err.statusCode || 500;
  const isServerError = status >= 500;
  const message = isServerError && env.isProduction ? 'Internal server error' : err.message || 'Internal server error';

  log(isServerError ? 'error' : 'info', 'request_error', {
    requestId: req.requestId,
    status,
    path: req.originalUrl,
    method: req.method,
    error: err.message || 'unknown_error',
  });

  return res.status(status).json({
    success: false,
    requestId: req.requestId,
    message,
  });
}
