import { User } from '../models/User.js';
import { Follow } from '../models/Follow.js';
import { destroyCloudinaryImage } from '../services/cloudinaryService.js';
import { sanitizeUser } from '../utils/sanitizeUser.js';

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCloudinaryPublicId(file) {
  return String(file?.filename || file?.public_id || '').trim();
}

async function deleteCloudinaryAvatar(publicId, context) {
  if (!publicId) return;
  await destroyCloudinaryImage(publicId, context);
}

export async function getMyProfile(req, res) {
  return res.json({
    success: true,
    data: { user: sanitizeUser(req.authUser) },
  });
}

export async function updateMyProfile(req, res, next) {
  try {
    const updates = req.body;
    const user = req.authUser;

    if (Object.prototype.hasOwnProperty.call(updates, 'avatarUrl')) {
      const nextAvatarUrl = String(updates.avatarUrl || '').trim();
      const currentAvatarUrl = String(user.avatarUrl || '').trim();
      if (nextAvatarUrl !== currentAvatarUrl && user.avatarPublicId) {
        try {
          await deleteCloudinaryAvatar(user.avatarPublicId, {
            action: 'profile_update',
            userId: String(user._id || ''),
          });
        } catch {
          // Ignore Cloudinary deletion failures during profile update.
        }
        user.avatarPublicId = '';
      }
    }

    Object.assign(user, updates);
    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated',
      data: { user: sanitizeUser(user) },
    });
  } catch (err) {
    next(err);
  }
}

export async function searchUsers(req, res, next) {
  try {
    const username = req.query.username;
    const currentUserId = req.authUser._id;
    const safeUsername = escapeRegex(username);

    const users = await User.find({
      username: { $regex: safeUsername, $options: 'i' },
      _id: { $ne: currentUserId },
    })
      .sort({ username: 1 })
      .limit(20)
      .select('fullName username avatarUrl followersCount followingCount bio gender dateOfBirth phoneNumber isPhoneVerified isOnline lastSeen settings.showOnlineStatus createdAt updatedAt');

    const userIds = users.map((user) => user._id);
    const followRows = await Follow.find({
      follower: currentUserId,
      following: { $in: userIds },
    })
      .select('following')
      .lean();

    const followingSet = new Set(followRows.map((row) => String(row.following)));

    return res.json({
      success: true,
      data: {
        users: users.map((user) => ({
          ...sanitizeUser({
            ...user.toObject(),
            isOnline: user.settings?.showOnlineStatus ? user.isOnline : false,
            lastSeen: user.settings?.showOnlineStatus ? user.lastSeen : null,
          }),
          isFollowing: followingSet.has(String(user._id)),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadMyAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    const avatarUrl = req.file?.path || req.file?.secure_url;
    if (!avatarUrl) {
      return res.status(500).json({ success: false, message: 'Upload failed. Missing avatar URL.' });
    }

    if (req.authUser.avatarPublicId) {
      try {
        await deleteCloudinaryAvatar(req.authUser.avatarPublicId, {
          action: 'avatar_upload',
          userId: String(req.authUser._id || ''),
        });
      } catch {
        // Ignore Cloudinary deletion failures during upload.
      }
    }

    const avatarPublicId = getCloudinaryPublicId(req.file);
    req.authUser.avatarUrl = avatarUrl;
    req.authUser.avatarPublicId = avatarPublicId;
    await req.authUser.save();

    return res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        user: sanitizeUser(req.authUser),
      },
    });
  } catch (err) {
    next(err);
  }
}
