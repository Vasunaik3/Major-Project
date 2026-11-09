import { Router } from 'express';
import { getSettings, putSettings, validateSettings } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../utils/validation.js';

const router = Router();
router.use(requireAuth);
router.get('/', getSettings);
router.put('/', validateBody(validateSettings), putSettings);

export default router;
