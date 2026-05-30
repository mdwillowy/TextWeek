import { Router } from 'express';
import { listReports } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/isAdmin.js';
import { adminReportsLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.use(requireAuth, requireAdmin);
router.get('/reports', adminReportsLimiter, listReports);

export default router;
