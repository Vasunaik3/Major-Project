import { Router } from 'express';
import { controlFan, fanStatus, validateFanControl } from '../controllers/fanController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../utils/validation.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'OPERATOR'));
router.get('/status', fanStatus);
router.post('/control', validateBody(validateFanControl), controlFan);

export default router;
