import { pool } from '../config/db.js';

export async function getProfile(req: any, res: any) {
  const { rows } = await pool.query('SELECT id,email,name,role,created_at FROM users WHERE id=$1', [req.user.id]);
  res.json(rows[0]);
}
