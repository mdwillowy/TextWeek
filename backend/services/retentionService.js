import { Message } from '../models/Message.js';

async function cleanupMessageArtifacts(_messageIds) {
  // Attachment cleanup hook for future media support.
  return;
}

function buildRetentionQuery(cutoffDate, now) {
  return {
    $or: [
      { createdAt: { $lt: cutoffDate } },
      { expiresAt: { $ne: null, $lte: now } },
    ],
  };
}

export async function runRetention({ retentionDays = 7, dryRun = false } = {}) {
  const startedAt = Date.now();
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const query = buildRetentionQuery(cutoffDate, now);

  const eligibleCount = await Message.countDocuments(query);
  if (dryRun) {
    return {
      dryRun: true,
      retentionDays,
      cutoffDate,
      eligibleCount,
      deletedCount: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const ids = await Message.find(query).select('_id').lean();
  const messageIds = ids.map((item) => item._id);
  await cleanupMessageArtifacts(messageIds);

  const result = await Message.deleteMany(query);

  return {
    dryRun: false,
    retentionDays,
    cutoffDate,
    eligibleCount,
    deletedCount: result.deletedCount || 0,
    durationMs: Date.now() - startedAt,
  };
}
