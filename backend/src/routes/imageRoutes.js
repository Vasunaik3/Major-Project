import { Router } from 'express';
import { getImage, listImages, uploadImage } from '../controllers/imageController.js';
import { imageUpload } from '../middleware/imageUpload.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.post('/', imageUpload.single('image'), uploadImage);
router.get('/',    listImages);
router.get('/:id', getImage);

export default router;
