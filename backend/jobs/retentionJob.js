import { env } from '../config/env.js';
import { runRetention } from '../services/retentionService.js';
import { log } from '../utils/logger.js';

let retentionTimer = null;
let running = false;

export async function runRetentionCycle({ dryRun = false, trigger = 'manual' } = {}) {
  if (running) {
    return { skipped: true, reason: 'already_running' };
  }

  running = true;
  try {
    const result = await runRetention({
      retentionDays: env.retentionDays,
      dryRun,
    });

    log('info', 'retention_cycle_complete', {
      trigger,
      dryRun: result.dryRun,
      retentionDays: result.retentionDays,
      eligibleCount: result.eligibleCount,
      deletedCount: result.deletedCount,
      durationMs: result.durationMs,
    });

    return result;
  } catch (err) {
    log('error', 'retention_cycle_failed', {
      trigger,
      error: err?.message || 'unknown_error',
    });
    throw err;
  } finally {
    running = false;
  }
}

export function startRetentionJob() {
  if (retentionTimer) {
    return;
  }

  const intervalMs = Math.max(1, env.retentionIntervalHours) * 60 * 60 * 1000;

  if (env.retentionRunOnStartup) {
    runRetentionCycle({ trigger: 'startup' }).catch(() => {});
  }

  retentionTimer = setInterval(() => {
    runRetentionCycle({ trigger: 'schedule' }).catch(() => {});
  }, intervalMs);
}
