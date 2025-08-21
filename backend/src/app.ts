import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import videoRoutes from './routes/video.routes.js';
import userRoutes from './routes/user.routes.js';
import { initDb } from './config/db.js';
import s3, { ensureBucket } from './config/s3.js';
import adminRoutes from './routes/admin.routes.js';
import ratingRoutes from './routes/rating.routes.js';
import commentRoutes from './routes/comment.routes.js';

dotenv.config();

const app = express();
app.use(express.json());

const origin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin, credentials: true }));

// static serving for uploaded files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadDir));

// Routes
app.get('/', (_req, res) => res.json({ ok: true, service: 'VidMarket API' }));

app.use('/auth', authRoutes);
app.use('/videos', videoRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/ratings', ratingRoutes);
app.use('/comments', commentRoutes);

// error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

// Экспорт функции инициализации
export { initDb };
export default app;