import { Router } from 'express';
import { simulatorStatus, updateSimulatorScenario, validateScenario } from '../controllers/simulatorController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../utils/validation.js';

const router = Router();
router.get('/scenario', requireAuth, requireRole('ADMIN', 'OPERATOR', 'VIEWER'), simulatorStatus);
router.put('/scenario', requireAuth, requireRole('ADMIN'), validateBody(validateScenario), updateSimulatorScenario);

export default router;
