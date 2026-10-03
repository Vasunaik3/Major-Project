import { Router } from 'express';
import { changeUserRole, getThresholds, listUsers, putThresholds, validateRoleChange, validateThresholds } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../utils/validation.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));
router.get('/users', listUsers);
router.patch('/users/:id/role', validateBody(validateRoleChange), changeUserRole);
router.get('/thresholds', getThresholds);
router.put('/thresholds', validateBody(validateThresholds), putThresholds);

export default router;
