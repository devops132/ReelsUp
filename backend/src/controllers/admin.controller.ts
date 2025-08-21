import { pool } from '../config/db.js';

export async function listPending(req:any, res:any) {
  const { rows } = await pool.query("SELECT v.*, u.name AS author_name FROM videos v JOIN users u ON u.id=v.user_id WHERE v.status=$1 ORDER BY v.created_at DESC", ['pending']);
  res.json(rows);
}

export async function changeStatus(req:any, res:any) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending','approved','rejected'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  const { rows } = await pool.query('UPDATE videos SET status=$1 WHERE id=$2 RETURNING *', [status, id]);
  res.json(rows[0]);
}
