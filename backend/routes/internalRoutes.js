import { Router } from 'express';
import { triggerRetentionRun } from '../controllers/retentionController.js';
import { requireInternalToken } from '../middleware/internalTokenAuth.js';

const router = Router();

router.use(requireInternalToken);
router.post('/retention/run', triggerRetentionRun);

export default router;
