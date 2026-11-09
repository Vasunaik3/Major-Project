import { Router } from 'express';
import { dashboardSummary } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.get('/summary', requireAuth, dashboardSummary);

export default router;
