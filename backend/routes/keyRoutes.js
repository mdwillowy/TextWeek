import { Router } from 'express';
import mongoose from 'mongoose';
import { getUserKeyBundle, putMyKeyBundle, rotateMyPreKey } from '../controllers/keyController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.put('/bundle', putMyKeyBundle);
router.post('/rotate-prekey', rotateMyPreKey);
router.get('/bundle/:userId', (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  }
  return getUserKeyBundle(req, res, next);
});

export default router;
