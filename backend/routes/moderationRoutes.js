import { Router } from 'express';
import { blockUser, getBlockStatus, listBlockedUsers, reportUser, unblockUser } from '../controllers/moderationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { reportLimiter } from '../middleware/rateLimiters.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { blockTargetValidator, reportUserValidator } from '../validators/moderationValidators.js';

const router = Router();

router.use(requireAuth);
router.post('/reports', reportLimiter, reportUserValidator, validateRequest, reportUser);
router.get('/blocks', listBlockedUsers);
router.get('/blocks/:targetUserId/status', blockTargetValidator, validateRequest, getBlockStatus);
router.post('/blocks/:targetUserId', blockTargetValidator, validateRequest, blockUser);
router.delete('/blocks/:targetUserId', blockTargetValidator, validateRequest, unblockUser);

export default router;
