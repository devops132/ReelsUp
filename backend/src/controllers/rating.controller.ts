// rating.controller.ts
import { pool } from '../config/db.js';

export async function rateVideo(req: any, res: any) {
  const userId = req.user.id;
  const { videoId } = req.params;
  const { value } = req.body;
  const v = parseInt(value);
  if (!v || v < 1 || v > 7) {
    return res.status(400).json({ error: 'value between 1 and 7 required' });
  }

  // upsert: if exists update, else insert
  const exists = await pool.query(
    'SELECT id FROM ratings WHERE user_id=$1 AND video_id=$2',
    [userId, videoId]
  );
  // TS18047: rowCount может быть null, поэтому используем ?? 0, чтобы получить число 0 по умолчанию
  const count = exists.rowCount ?? 0;
  if (count > 0) {
    await pool.query(
      'UPDATE ratings SET value=$1 WHERE user_id=$2 AND video_id=$3',
      [v, userId, videoId]
    );
  } else {
    await pool.query(
      'INSERT INTO ratings(video_id, user_id, value) VALUES($1, $2, $3)',
      [videoId, userId, v]
    );
  }
  // calculate average
  const avgRes = await pool.query(
    'SELECT AVG(value) as avg FROM ratings WHERE video_id=$1',
    [videoId]
  );
  res.json({ average: parseFloat(avgRes.rows[0].avg) || 0 });
}
