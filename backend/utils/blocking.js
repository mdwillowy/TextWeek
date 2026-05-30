import { UserBlock } from '../models/UserBlock.js';

export async function getBlockRelationship(userA, userB) {
  const row = await UserBlock.findOne({
    $or: [
      { blocker: userA, blocked: userB },
      { blocker: userB, blocked: userA },
    ],
  })
    .select('blocker blocked')
    .lean();

  if (!row) {
    return {
      blocked: false,
      blockedBySelf: false,
      blockedByOther: false,
    };
  }

  const blockedBySelf = String(row.blocker) === String(userA);
  return {
    blocked: true,
    blockedBySelf,
    blockedByOther: !blockedBySelf,
  };
}

export async function isBlockedEitherWay(userA, userB) {
  const relation = await getBlockRelationship(userA, userB);
  return relation.blocked;
}
