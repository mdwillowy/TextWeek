import mongoose from 'mongoose';
import { Follow } from '../models/Follow.js';
import { User } from '../models/User.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';

function mapUser(userDoc) {
  return {
    id: String(userDoc._id),
    fullName: userDoc.fullName,
    username: userDoc.username,
    avatarUrl: userDoc.avatarUrl || '',
    followersCount: userDoc.followersCount || 0,
    followingCount: userDoc.followingCount || 0,
    bio: userDoc.bio || '',
  };
}

export async function followUser(req, res, next) {
  try {
    const followerId = req.authUser._id;
    const { targetUserId } = req.params;

    if (String(followerId) === String(targetUserId)) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    const existingRelation = await Follow.findOne({
      follower: followerId,
      following: targetUserId,
    })
      .select('_id')
      .lean();

    if (existingRelation) {
      return res.json({ success: true, message: 'Already following' });
    }

    try {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          await Follow.create(
            [
              {
                follower: followerId,
                following: targetUserId,
              },
            ],
            { session }
          );

          await Promise.all([
            User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }, { session }),
            User.updateOne({ _id: targetUserId }, { $inc: { followersCount: 1 } }, { session }),
          ]);
        });
      } finally {
        await session.endSession();
      }
    } catch (err) {
      if (err?.code === 11000) {
        return res.json({ success: true, message: 'Already following' });
      }

      const txnUnavailable = String(err?.message || '').toLowerCase().includes('transaction');
      if (!txnUnavailable) {
        throw err;
      }

      try {
        await Follow.create({
          follower: followerId,
          following: targetUserId,
        });
      } catch (createErr) {
        if (createErr?.code === 11000) {
          return res.json({ success: true, message: 'Already following' });
        }
        throw createErr;
      }

      await Promise.all([
        User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
        User.updateOne({ _id: targetUserId }, { $inc: { followersCount: 1 } }),
      ]);
    }

    return res.status(201).json({ success: true, message: 'Followed user successfully' });
  } catch (err) {
    next(err);
  }
}

export async function unfollowUser(req, res, next) {
  try {
    const followerId = req.authUser._id;
    const { targetUserId } = req.params;

    if (String(followerId) === String(targetUserId)) {
      return res.status(400).json({ success: false, message: 'You cannot unfollow yourself' });
    }

    try {
      const session = await mongoose.startSession();

      try {
        let hadRelation = false;

        await session.withTransaction(async () => {
          const result = await Follow.findOneAndDelete(
            {
              follower: followerId,
              following: targetUserId,
            },
            { session }
          );

          hadRelation = Boolean(result);
          if (!hadRelation) {
            return;
          }

          await Promise.all([
            User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }, { session }),
            User.updateOne({ _id: targetUserId }, { $inc: { followersCount: -1 } }, { session }),
          ]);
        });

        if (!hadRelation) {
          return res.json({ success: true, message: 'Already not following' });
        }
      } finally {
        await session.endSession();
      }
    } catch (err) {
      const txnUnavailable = String(err?.message || '').toLowerCase().includes('transaction');
      if (!txnUnavailable) {
        throw err;
      }

      const result = await Follow.findOneAndDelete({
        follower: followerId,
        following: targetUserId,
      });

      if (!result) {
        return res.json({ success: true, message: 'Already not following' });
      }

      await Promise.all([
        User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }),
        User.updateOne({ _id: targetUserId }, { $inc: { followersCount: -1 } }),
      ]);
    }

    return res.json({ success: true, message: 'Unfollowed user successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getFollowStatus(req, res, next) {
  try {
    const followerId = req.authUser._id;
    const { userId } = req.params;

    if (String(followerId) === String(userId)) {
      return res.json({ success: true, data: { isFollowing: false } });
    }

    const relation = await Follow.findOne({
      follower: followerId,
      following: userId,
    }).lean();

    return res.json({
      success: true,
      data: {
        isFollowing: Boolean(relation),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getFollowers(req, res, next) {
  try {
    const { userId } = req.params;
    const { page, limit, skip } = parsePagination(req.query, { page: 1, limit: 20, maxLimit: 50 });

    const [rows, total] = await Promise.all([
      Follow.find({ following: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('follower', 'fullName username avatarUrl followersCount followingCount bio')
        .lean(),
      Follow.countDocuments({ following: userId }),
    ]);

    const users = rows
      .map((item) => item.follower)
      .filter(Boolean)
      .map((user) => mapUser(user));

    return res.json({
      success: true,
      data: { users },
      meta: paginationMeta({ total, page, limit }),
    });
  } catch (err) {
    next(err);
  }
}

export async function getFollowing(req, res, next) {
  try {
    const { userId } = req.params;
    const { page, limit, skip } = parsePagination(req.query, { page: 1, limit: 20, maxLimit: 50 });

    const [rows, total] = await Promise.all([
      Follow.find({ follower: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('following', 'fullName username avatarUrl followersCount followingCount bio')
        .lean(),
      Follow.countDocuments({ follower: userId }),
    ]);

    const users = rows
      .map((item) => item.following)
      .filter(Boolean)
      .map((user) => mapUser(user));

    return res.json({
      success: true,
      data: { users },
      meta: paginationMeta({ total, page, limit }),
    });
  } catch (err) {
    next(err);
  }
}

export async function removeFollower(req, res, next) {
  try {
    const currentUserId = req.authUser._id;
    const { followerUserId } = req.params;

    if (String(currentUserId) === String(followerUserId)) {
      return res.status(400).json({ success: false, message: 'You cannot remove yourself as follower' });
    }

    const result = await Follow.findOneAndDelete({
      follower: followerUserId,
      following: currentUserId,
    });

    if (!result) {
      return res.json({ success: true, message: 'User is not following you' });
    }

    await Promise.all([
      User.updateOne({ _id: currentUserId }, { $inc: { followersCount: -1 } }),
      User.updateOne({ _id: followerUserId }, { $inc: { followingCount: -1 } }),
    ]);

    return res.json({ success: true, message: 'Follower removed successfully' });
  } catch (err) {
    next(err);
  }
}
