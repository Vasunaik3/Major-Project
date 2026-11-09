import { Router } from 'express';
import { listAlerts, resolveAlert } from '../controllers/alertController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/',               listAlerts);
router.patch('/:id/resolve',  resolveAlert);

export default router;
