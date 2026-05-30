import { pingDB } from '../config/db.js';
import { env } from '../config/env.js';

export function health(_req, res) {
  return res.json({
    success: true,
    status: 'ok',
    service: 'textweek-backend',
    env: env.nodeEnv,
    time: new Date().toISOString(),
  });
}

export async function ready(_req, res) {
  try {
    const dbReady = await pingDB();
    if (!dbReady) {
      return res.status(503).json({
        success: false,
        status: 'not_ready',
        checks: { db: false },
      });
    }

    return res.json({
      success: true,
      status: 'ready',
      checks: { db: true },
      time: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      success: false,
      status: 'not_ready',
      checks: { db: false },
    });
  }
}
