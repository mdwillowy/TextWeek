import { runRetentionCycle } from '../jobs/retentionJob.js';

export async function triggerRetentionRun(req, res, next) {
  try {
    const dryRun = String(req.query.dryRun || 'true').toLowerCase() === 'true';
    const result = await runRetentionCycle({
      dryRun,
      trigger: 'internal_endpoint',
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
