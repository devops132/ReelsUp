import { pool } from '../config/db.js';

export async function listComments(req:any, res:any) {
  const { videoId } = req.params;
  const { rows } = await pool.query('SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.video_id=$1 ORDER BY c.created_at DESC', [videoId]);
  res.json(rows);
}

export async function postComment(req:any, res:any) {
  const userId = req.user.id;
  const { videoId } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const { rows } = await pool.query('INSERT INTO comments(video_id,user_id,text) VALUES($1,$2,$3) RETURNING *', [videoId, userId, text]);
  res.status(201).json(rows[0]);
}

export async function deleteComment(req:any, res:any) {
  const userId = req.user.id;
  const { id } = req.params;
  // only author or admin
  const { rows } = await pool.query('SELECT * FROM comments WHERE id=$1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  const comment = rows[0];
  const userRow = await pool.query('SELECT role FROM users WHERE id=$1', [userId]);
  const role = userRow.rows[0]?.role;
  if (comment.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  await pool.query('DELETE FROM comments WHERE id=$1', [id]);
  res.json({ ok: true });
}
