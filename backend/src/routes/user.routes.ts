import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getProfile } from '../controllers/user.controller.js';

const router = Router();
router.get('/me', authMiddleware, getProfile);

export default router;
