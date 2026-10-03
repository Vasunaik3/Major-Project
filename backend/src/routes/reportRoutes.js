import { Router } from 'express';
import { getStorageReport } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.get('/', requireAuth, requireRole('ADMIN', 'VIEWER'), getStorageReport);

export default router;
