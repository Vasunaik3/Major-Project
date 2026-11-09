import { Router } from 'express';
import { getUploadedFile } from '../controllers/imageController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.get('/:filename', requireAuth, getUploadedFile);

export default router;
