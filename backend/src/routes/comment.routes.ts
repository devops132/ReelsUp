import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listComments, postComment, deleteComment } from '../controllers/comment.controller.js';
const router = Router();
router.get('/video/:videoId', listComments);
router.post('/video/:videoId', authMiddleware, postComment);
router.delete('/:id', authMiddleware, deleteComment);
export default router;
