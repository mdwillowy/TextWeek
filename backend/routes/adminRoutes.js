import { Router } from 'express';
import { approveDeletionRequest, cancelDeletionRequest, listDeletionRequests, listReports } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/isAdmin.js';
import { adminReportsLimiter } from '../middleware/rateLimiters.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { userIdParamValidator } from '../validators/adminValidators.js';

const router = Router();

router.use(requireAuth, requireAdmin);
router.get('/reports', adminReportsLimiter, listReports);
router.get('/deletion-requests', adminReportsLimiter, listDeletionRequests);
router.post('/deletion-requests/:userId/approve', adminReportsLimiter, userIdParamValidator, validateRequest, approveDeletionRequest);
router.post('/deletion-requests/:userId/cancel', adminReportsLimiter, userIdParamValidator, validateRequest, cancelDeletionRequest);

export default router;
