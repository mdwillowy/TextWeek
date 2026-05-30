import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

function buildLimiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });
}

export const authLimiter = buildLimiter(
  env.rateLimitAuthWindowMs,
  env.rateLimitAuthMax,
  'Too many authentication attempts. Please try again later.'
);

export const chatSendLimiter = buildLimiter(
  env.rateLimitMessageWindowMs,
  env.rateLimitMessageMax,
  'Too many messages sent in a short time. Please slow down.'
);

export const searchLimiter = buildLimiter(
  env.rateLimitSearchWindowMs,
  env.rateLimitSearchMax,
  'Too many search requests. Please wait a moment.'
);

export const followLimiter = buildLimiter(
  env.rateLimitFollowWindowMs,
  env.rateLimitFollowMax,
  'Too many follow actions in a short time. Please slow down.'
);

export const reportLimiter = buildLimiter(
  env.rateLimitReportWindowMs,
  env.rateLimitReportMax,
  'Too many report submissions. Please try again later.'
);

export const adminReportsLimiter = buildLimiter(
  env.rateLimitAdminWindowMs,
  env.rateLimitAdminMax,
  'Too many admin requests. Please try again later.'
);
