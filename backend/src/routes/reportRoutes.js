import { Router } from 'express';
import { getStorageReport } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.get('/', requireAuth, getStorageReport);

export default router;
