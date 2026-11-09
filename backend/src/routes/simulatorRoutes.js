import { Router } from 'express';
import { simulatorStatus, updateSimulatorScenario, validateScenario } from '../controllers/simulatorController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../utils/validation.js';

const router = Router();
router.get('/scenario', requireAuth, simulatorStatus);
router.put('/scenario', requireAuth, validateBody(validateScenario), updateSimulatorScenario);

export default router;
