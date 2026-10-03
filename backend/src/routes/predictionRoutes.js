import { Router } from 'express';
import { getPredictions } from '../controllers/predictionController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.get('/', requireAuth, requireRole('ADMIN', 'OPERATOR'), getPredictions);

export default router;
