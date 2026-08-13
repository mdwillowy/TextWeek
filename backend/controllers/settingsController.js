import { env } from '../config/env.js';
import { getIO } from '../socket/index.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { sanitizeUser } from '../utils/sanitizeUser.js';

export async function updateMySettings(req, res, next) {
  try {
    const user = req.authUser;
    const incoming = req.body || {};
    const previousShowOnlineStatus = user.settings?.showOnlineStatus ?? true;

    const nextReadReceipts = env.featureReadReceipts
      ? typeof incoming.readReceipts === 'boolean'
        ? incoming.readReceipts
        : typeof incoming.readReceiptsEnabled === 'boolean'
          ? incoming.readReceiptsEnabled
          : user.settings?.readReceiptsEnabled ?? true
      : user.settings?.readReceiptsEnabled ?? true;

    const nextShowOnlineStatus =
      typeof incoming.showOnlineStatus === 'boolean'
        ? incoming.showOnlineStatus
        : user.settings?.showOnlineStatus ?? true;

    const nextTheme = incoming.themeMode || incoming.theme || user.settings?.theme || 'system';
    user.isPrivate = typeof incoming.isPrivate === 'boolean' ? incoming.isPrivate : user.isPrivate ?? false;
    user.settings = {
      readReceiptsEnabled: nextReadReceipts,
      showOnlineStatus: nextShowOnlineStatus,
      theme: nextTheme,
    };

    await user.save();

    const persistedShowOnlineStatus = user.settings?.showOnlineStatus ?? true;
    if (env.featureOnlineStatus && previousShowOnlineStatus !== persistedShowOnlineStatus) {
      const io = getIO();
      if (io) {
        io.emit('presence:update', {
          userId: String(user._id),
          online: persistedShowOnlineStatus ? Boolean(user.isOnline) : false,
          lastSeen: persistedShowOnlineStatus ? user.lastSeen || null : null,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Settings updated',
      data: { user: sanitizeUser(user) },
    });
  } catch (err) {
    next(err);
  }
}

export async function requestAccountDeletion(req, res, next) {
  try {
    const { password } = req.body;
    const user = req.authUser;

    const matches = await comparePassword(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({
        success: false,
        message: 'Password confirmation failed',
      });
    }

    if (!user.deletionRequestedAt) {
      user.deletionRequestedAt = new Date();
      await user.save();
    }

    return res.json({
      success: true,
      message: 'Account deletion request has been recorded for manual review',
      data: {
        deletionRequestedAt: user.deletionRequestedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function changeMyPassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.authUser;

    const matches = await comparePassword(currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const isSame = await comparePassword(newPassword, user.passwordHash);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return res.json({
      success: true,
      message: 'Password updated successfully',
      data: { user: sanitizeUser(user) },
    });
  } catch (err) {
    next(err);
  }
}
