import { User } from '../models/User.js';

export async function getUserPresence(req, res, next) {
  try {
    const user = await User.findById(req.params.userId).select('isOnline lastSeen settings.showOnlineStatus');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isVisible = user.settings?.showOnlineStatus ?? true;
    return res.json({
      success: true,
      data: {
        isOnline: isVisible ? Boolean(user.isOnline) : false,
        lastSeen: isVisible ? user.lastSeen || null : null,
      },
    });
  } catch (err) {
    next(err);
  }
}
