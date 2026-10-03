import { Router } from 'express';
import { dashboardSummary } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.get('/summary', requireAuth, requireRole('ADMIN', 'OPERATOR', 'VIEWER'), dashboardSummary);

export default router;
