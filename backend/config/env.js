import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const required = ['PORT', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const cloudinaryRequired = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

function isSecretStrong(value) {
  const secret = String(value || '');
  const hasMixedCharset =
    secret.length >= 32 && /[a-z]/.test(secret) && /[A-Z]/.test(secret) && /\d/.test(secret);
  const isStrongHex = /^[a-f0-9]{64,}$/i.test(secret);
  const isStrongBase64 = /^[A-Za-z0-9+/=_-]{43,}$/.test(secret);

  // Accept mixed charset tokens, long hex tokens, or long base64/url-safe tokens.
  return hasMixedCharset || isStrongHex || isStrongBase64;
}

if (!process.env.MONGODB_URI && !process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: MONGODB_URI or DATABASE_URL');
}

if (!process.env.CLIENT_ORIGIN && !process.env.CORS_ALLOWED_ORIGINS) {
  throw new Error('Missing required environment variable: CLIENT_ORIGIN or CORS_ALLOWED_ORIGINS');
}

if (isProduction && !process.env.INTERNAL_JOB_TOKEN) {
  throw new Error('Missing required environment variable in production: INTERNAL_JOB_TOKEN');
}

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

for (const key of cloudinaryRequired) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const weakSecrets = [];
if (!isSecretStrong(process.env.JWT_ACCESS_SECRET)) {
  weakSecrets.push('JWT_ACCESS_SECRET');
}
if (!isSecretStrong(process.env.JWT_REFRESH_SECRET)) {
  weakSecrets.push('JWT_REFRESH_SECRET');
}
if (process.env.INTERNAL_JOB_TOKEN && !isSecretStrong(process.env.INTERNAL_JOB_TOKEN)) {
  weakSecrets.push('INTERNAL_JOB_TOKEN');
}

if (weakSecrets.length > 0 && isProduction) {
  throw new Error(
    `Weak security secret(s): ${weakSecrets.join(', ')}. Use strong random values (e.g. >=64 hex chars or >=43 base64 chars).`
  );
}

if (weakSecrets.length > 0 && !isProduction) {
  console.warn(
    `[security] Weak secret(s) detected for development: ${weakSecrets.join(', ')}. Rotate before production deployment.`
  );
}

const corsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN;
const socketCorsOrigins = process.env.SOCKET_CORS_ORIGIN || corsAllowedOrigins;

function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI || process.env.DATABASE_URL,
  clientOrigin: process.env.CLIENT_ORIGIN || corsAllowedOrigins,
  clientOrigins: corsAllowedOrigins.split(',').map((item) => item.trim()),
  socketOrigins: socketCorsOrigins.split(',').map((item) => item.trim()),
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  cookieSecure: toBoolean(process.env.COOKIE_SECURE, isProduction),
  cookieSameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '100kb',
  retentionDays: Number(process.env.RETENTION_DAYS) || 7,
  retentionIntervalHours: Number(process.env.RETENTION_INTERVAL_HOURS) || 24,
  retentionRunOnStartup: toBoolean(process.env.RETENTION_RUN_ON_STARTUP, true),
  internalJobToken: process.env.INTERNAL_JOB_TOKEN || '',
  trustProxy: toBoolean(process.env.TRUST_PROXY, false),
  logLevel: process.env.LOG_LEVEL || 'info',
  sentryDsn: process.env.SENTRY_DSN || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',

  rateLimitAuthWindowMs: toNumber(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
  rateLimitAuthMax: toNumber(process.env.RATE_LIMIT_AUTH_MAX, 30),
  rateLimitMessageWindowMs: toNumber(process.env.RATE_LIMIT_MESSAGE_WINDOW_MS, 60 * 1000),
  rateLimitMessageMax: toNumber(process.env.RATE_LIMIT_MESSAGE_MAX, 45),
  rateLimitSearchWindowMs: toNumber(process.env.RATE_LIMIT_SEARCH_WINDOW_MS, 60 * 1000),
  rateLimitSearchMax: toNumber(process.env.RATE_LIMIT_SEARCH_MAX, 40),
  rateLimitFollowWindowMs: toNumber(process.env.RATE_LIMIT_FOLLOW_WINDOW_MS, 60 * 1000),
  rateLimitFollowMax: toNumber(process.env.RATE_LIMIT_FOLLOW_MAX, 40),
  rateLimitReportWindowMs: toNumber(process.env.RATE_LIMIT_REPORT_WINDOW_MS, 10 * 60 * 1000),
  rateLimitReportMax: toNumber(process.env.RATE_LIMIT_REPORT_MAX, 20),
  rateLimitAdminWindowMs: toNumber(process.env.RATE_LIMIT_ADMIN_WINDOW_MS, 60 * 1000),
  rateLimitAdminMax: toNumber(process.env.RATE_LIMIT_ADMIN_MAX, 30),

  enableNewRegistrations: toBoolean(process.env.ENABLE_NEW_REGISTRATIONS, true),
  featureReadReceipts: toBoolean(process.env.FEATURE_READ_RECEIPTS, true),
  featureOnlineStatus: toBoolean(process.env.FEATURE_ONLINE_STATUS, true),
  featureE2EE: toBoolean(process.env.FEATURE_E2EE, true),
};
