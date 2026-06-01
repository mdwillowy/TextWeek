import { Chat } from '../models/Chat.js';
import { Follow } from '../models/Follow.js';
import { KeyBundle } from '../models/KeyBundle.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { UserBlock } from '../models/UserBlock.js';
import { UserReport } from '../models/UserReport.js';
import { destroyCloudinaryImage } from '../services/cloudinaryService.js';

export async function listReports(req, res, next) {
  try {
    const pageRaw = Number(req.query.page || 1);
    const pageSizeRaw = Number(req.query.pageSize || 20);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, 100)
      : 20;
    const skip = (page - 1) * pageSize;

    const total = await UserReport.countDocuments();
    const reports = await UserReport.find({})
      .populate('reporter', 'fullName username avatarUrl')
      .populate('targetUser', 'fullName username avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    console.log('[admin_audit] reports_list', {
      adminUserId: String(req.authUser?._id || ''),
      ip: String(req.ip || ''),
      at: new Date().toISOString(),
      page,
      pageSize,
    });

    return res.json({
      success: true,
      data: {
        page,
        pageSize,
        total,
        reports: reports.map((report) => ({
          id: String(report._id),
          reporter: report.reporter
            ? {
                id: String(report.reporter._id),
                fullName: report.reporter.fullName,
                username: report.reporter.username,
                avatarUrl: report.reporter.avatarUrl || '',
              }
            : null,
          targetUser: report.targetUser
            ? {
                id: String(report.targetUser._id),
                fullName: report.targetUser.fullName,
                username: report.targetUser.username,
                avatarUrl: report.targetUser.avatarUrl || '',
              }
            : null,
          reason: report.reason,
          details: report.details || '',
          status: report.status,
          createdAt: report.createdAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function deleteUserData(user) {
  const userId = String(user?._id || '');
  if (!userId) return;

  if (user.avatarPublicId) {
    try {
      await destroyCloudinaryImage(user.avatarPublicId, {
        action: 'admin_delete',
        userId,
      });
    } catch {
      // Ignore Cloudinary failures during admin deletion.
    }
  }

  const chats = await Chat.find({ participants: userId }).select('_id').lean();
  const chatIds = chats.map((chat) => chat._id);

  await Promise.all([
    Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
    UserBlock.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] }),
    UserReport.deleteMany({ $or: [{ reporter: userId }, { targetUser: userId }] }),
    KeyBundle.deleteMany({ user: userId }),
    Message.deleteMany({ $or: [{ chat: { $in: chatIds } }, { sender: userId }] }),
    Chat.deleteMany({ _id: { $in: chatIds } }),
  ]);

  await User.deleteOne({ _id: userId });
}

export async function listDeletionRequests(req, res, next) {
  try {
    const pageRaw = Number(req.query.page || 1);
    const pageSizeRaw = Number(req.query.pageSize || 20);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, 100)
      : 20;
    const skip = (page - 1) * pageSize;

    const query = { deletionRequestedAt: { $ne: null } };
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ deletionRequestedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .select('fullName username avatarUrl deletionRequestedAt')
      .lean();

    console.log('[admin_audit] deletion_requests_list', {
      adminUserId: String(req.authUser?._id || ''),
      ip: String(req.ip || ''),
      at: new Date().toISOString(),
      page,
      pageSize,
    });

    return res.json({
      success: true,
      data: {
        page,
        pageSize,
        total,
        users: users.map((user) => ({
          id: String(user._id),
          fullName: user.fullName,
          username: user.username,
          avatarUrl: user.avatarUrl || '',
          deletionRequestedAt: user.deletionRequestedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function approveDeletionRequest(req, res, next) {
  try {
    const userId = String(req.params.userId || '');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await deleteUserData(user);

    console.log('[admin_audit] deletion_request_approved', {
      adminUserId: String(req.authUser?._id || ''),
      targetUserId: userId,
      ip: String(req.ip || ''),
      at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Account deletion approved and completed',
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelDeletionRequest(req, res, next) {
  try {
    const userId = String(req.params.userId || '');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.deletionRequestedAt = null;
    await user.save();

    console.log('[admin_audit] deletion_request_cancelled', {
      adminUserId: String(req.authUser?._id || ''),
      targetUserId: userId,
      ip: String(req.ip || ''),
      at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Deletion request cancelled',
    });
  } catch (err) {
    next(err);
  }
}
