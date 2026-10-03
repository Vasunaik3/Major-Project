import { Router } from 'express';
import { getImage, listImages, uploadImage } from '../controllers/imageController.js';
import { imageUpload } from '../middleware/imageUpload.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'OPERATOR'));
router.post('/', imageUpload.single('image'), uploadImage);
router.get('/', listImages);
router.get('/:id', getImage);

export default router;
