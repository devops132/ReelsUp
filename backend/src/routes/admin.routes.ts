import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { listPending, changeStatus } from '../controllers/admin.controller.js';

const router = Router();
router.get('/videos', authMiddleware, adminMiddleware, listPending);
router.patch('/videos/:id/status', authMiddleware, adminMiddleware, changeStatus);

export default router;
