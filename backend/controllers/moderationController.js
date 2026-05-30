import { User } from '../models/User.js';
import { UserReport } from '../models/UserReport.js';
import { UserBlock } from '../models/UserBlock.js';
import { getBlockRelationship } from '../utils/blocking.js';

export async function reportUser(req, res, next) {
  try {
    const reporterId = req.authUser._id;
    const { targetUserId, reason, details } = req.body;

    if (String(reporterId) === String(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report yourself',
      });
    }

    const target = await User.findById(targetUserId).select('_id');
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    await UserReport.create({
      reporter: reporterId,
      targetUser: targetUserId,
      reason,
      details: details || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Report submitted',
    });
  } catch (err) {
    next(err);
  }
}

export async function blockUser(req, res, next) {
  try {
    const blockerId = req.authUser._id;
    const { targetUserId } = req.params;

    if (String(blockerId) === String(targetUserId)) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself' });
    }

    const target = await User.findById(targetUserId).select('_id');
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    await UserBlock.updateOne(
      { blocker: blockerId, blocked: targetUserId },
      { $setOnInsert: { blocker: blockerId, blocked: targetUserId } },
      { upsert: true }
    );

    return res.status(201).json({ success: true, message: 'User blocked' });
  } catch (err) {
    next(err);
  }
}

export async function unblockUser(req, res, next) {
  try {
    const blockerId = req.authUser._id;
    const { targetUserId } = req.params;

    await UserBlock.deleteOne({ blocker: blockerId, blocked: targetUserId });
    return res.json({ success: true, message: 'User unblocked' });
  } catch (err) {
    next(err);
  }
}

export async function listBlockedUsers(req, res, next) {
  try {
    const rows = await UserBlock.find({ blocker: req.authUser._id })
      .populate('blocked', 'fullName username avatarUrl')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        users: rows
          .map((row) => row.blocked)
          .filter(Boolean)
          .map((user) => ({
            id: String(user._id),
            fullName: user.fullName,
            username: user.username,
            avatarUrl: user.avatarUrl || '',
          })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getBlockStatus(req, res, next) {
  try {
    const requesterId = req.authUser._id;
    const { targetUserId } = req.params;

    if (String(requesterId) === String(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid target user' });
    }

    const target = await User.findById(targetUserId).select('_id');
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    const relation = await getBlockRelationship(requesterId, targetUserId);

    return res.json({
      success: true,
      data: relation,
    });
  } catch (err) {
    next(err);
  }
}
