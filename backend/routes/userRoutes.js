import { Router } from 'express';
import {
  getMyProfile,
  searchUsers,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  updateMyProfile,
  uploadMyAvatar,
} from '../controllers/userController.js';
import { changeMyPassword, requestAccountDeletion, updateMySettings } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { searchLimiter } from '../middleware/rateLimiters.js';
import { searchUsersValidator, updateProfileValidator } from '../validators/userValidators.js';
import { changePasswordValidator, requestDeletionValidator, updateSettingsValidator } from '../validators/settingsValidators.js';
import { avatarUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/me', getMyProfile);
router.patch('/me', updateProfileValidator, validateRequest, updateMyProfile);
router.patch('/me/settings', updateSettingsValidator, validateRequest, updateMySettings);
router.post('/me/change-password', changePasswordValidator, validateRequest, changeMyPassword);
router.post('/me/request-deletion', requestDeletionValidator, validateRequest, requestAccountDeletion);
router.post('/me/avatar', avatarUpload.single('avatar'), uploadMyAvatar);
router.post('/me/push/subscribe', subscribeToPushNotifications);
router.post('/me/push/unsubscribe', unsubscribeFromPushNotifications);
router.get('/search', searchLimiter, searchUsersValidator, validateRequest, searchUsers);

export default router;
