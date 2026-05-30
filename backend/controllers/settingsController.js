import { comparePassword } from '../utils/password.js';
import { sanitizeUser } from '../utils/sanitizeUser.js';

export async function updateMySettings(req, res, next) {
  try {
    const user = req.authUser;
    const incoming = req.body || {};

    user.settings = {
      showOnlineStatus:
        typeof incoming.showOnlineStatus === 'boolean'
          ? incoming.showOnlineStatus
          : user.settings?.showOnlineStatus ?? true,
      theme: incoming.theme || user.settings?.theme || 'system',
    };

    await user.save();

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
