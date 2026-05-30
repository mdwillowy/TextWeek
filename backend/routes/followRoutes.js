import { Router } from 'express';
import {
  followUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
  removeFollower,
  unfollowUser,
} from '../controllers/followController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { followLimiter } from '../middleware/rateLimiters.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  followerUserIdValidator,
  followListValidator,
  followStatusValidator,
  targetUserIdValidator,
} from '../validators/followValidators.js';

const router = Router();

router.use(requireAuth);
router.post('/:targetUserId', followLimiter, targetUserIdValidator, validateRequest, followUser);
router.delete('/:targetUserId', followLimiter, targetUserIdValidator, validateRequest, unfollowUser);
router.delete('/followers/:followerUserId', followLimiter, followerUserIdValidator, validateRequest, removeFollower);
router.get('/followers/:userId', followListValidator, validateRequest, getFollowers);
router.get('/following/:userId', followListValidator, validateRequest, getFollowing);
router.get('/status/:userId', followStatusValidator, validateRequest, getFollowStatus);

export default router;
