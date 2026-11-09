import { Router } from 'express';
import { getPredictions } from '../controllers/predictionController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.get('/', requireAuth, getPredictions);

export default router;
