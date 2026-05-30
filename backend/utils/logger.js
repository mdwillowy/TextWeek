import { env } from '../config/env.js';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function redactMeta(meta = {}) {
  const clone = { ...meta };

  if (clone.authorization) clone.authorization = '[redacted]';
  if (clone.cookie) clone.cookie = '[redacted]';
  if (clone.refreshToken) clone.refreshToken = '[redacted]';
  if (clone.password) clone.password = '[redacted]';

  return clone;
}

export function log(level, message, meta = {}) {
  const currentLevel = levels[env.logLevel] ?? levels.info;
  const targetLevel = levels[level] ?? levels.info;
  if (targetLevel > currentLevel) {
    return;
  }

  const row = {
    level,
    message,
    time: new Date().toISOString(),
    ...redactMeta(meta),
  };

  const output = JSON.stringify(row);
  if (level === 'error') {
    console.error(output);
    return;
  }
  console.log(output);
}
