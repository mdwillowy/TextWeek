import { env } from '../config/env.js';
import { log } from './logger.js';

export function initMonitoring() {
  if (!env.sentryDsn) {
    log('info', 'monitoring_disabled', { reason: 'SENTRY_DSN not configured' });
    return;
  }

  // Placeholder for Sentry or equivalent integration initialization.
  // Example future integration:
  // Sentry.init({ dsn: env.sentryDsn, environment: env.nodeEnv, tracesSampleRate: 0.1 });
  log('info', 'monitoring_enabled', { provider: 'sentry_placeholder' });
}
