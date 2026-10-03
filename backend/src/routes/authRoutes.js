import { Router } from 'express';
import { login, logout, me, register, validateLogin, validateRegister } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../utils/validation.js';

const router = Router();
router.post('/register', validateBody(validateRegister), register);
router.post('/login', validateBody(validateLogin), login);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);

export default router;
