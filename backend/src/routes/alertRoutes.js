import { Router } from 'express';
import { listAlerts, resolveAlert } from '../controllers/alertController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'OPERATOR'));
router.get('/', listAlerts);
router.patch('/:id/resolve', requireRole('ADMIN'), resolveAlert);

export default router;
