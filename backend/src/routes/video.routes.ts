import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../middleware/auth.js';
// import { createVideo, listVideos, getVideo } from '../controllers/video.controller.js';
import { uploadVideo, listVideos, getVideo } from '../controllers/video.controller.js';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

router.get('/', listVideos);
router.get('/:id', getVideo);
// router.post('/', authMiddleware, upload.single('video'), createVideo);
router.post('/', authMiddleware, upload.single('video'), uploadVideo);
export default router;
