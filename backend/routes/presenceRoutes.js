import { Router } from 'express';
import mongoose from 'mongoose';
import { getUserPresence } from '../controllers/presenceController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/:userId', (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  }

  return getUserPresence(req, res, next);
});

export default router;
