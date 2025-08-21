import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { rateVideo } from '../controllers/rating.controller.js';
const router = Router();
router.post('/:videoId', authMiddleware, rateVideo);
export default router;
