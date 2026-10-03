import { Router } from 'express';
import { getUploadedFile } from '../controllers/imageController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.get('/:filename', requireAuth, requireRole('ADMIN', 'OPERATOR'), getUploadedFile);

export default router;
