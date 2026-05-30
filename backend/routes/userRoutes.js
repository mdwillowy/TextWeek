import { Router } from 'express';
import { getMyProfile, searchUsers, updateMyProfile, uploadMyAvatar } from '../controllers/userController.js';
import { requestAccountDeletion, updateMySettings } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { searchLimiter } from '../middleware/rateLimiters.js';
import { searchUsersValidator, updateProfileValidator } from '../validators/userValidators.js';
import { requestDeletionValidator, updateSettingsValidator } from '../validators/settingsValidators.js';
import { avatarUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/me', getMyProfile);
router.patch('/me', updateProfileValidator, validateRequest, updateMyProfile);
router.patch('/me/settings', updateSettingsValidator, validateRequest, updateMySettings);
router.post('/me/request-deletion', requestDeletionValidator, validateRequest, requestAccountDeletion);
router.post('/me/avatar', avatarUpload.single('avatar'), uploadMyAvatar);
router.get('/search', searchLimiter, searchUsersValidator, validateRequest, searchUsers);

export default router;
