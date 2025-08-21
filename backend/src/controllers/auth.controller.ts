import { pool } from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

export async function register(req: any, res: any) {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hashed = await bcrypt.hash(password, 10);
  try {
    const q = `INSERT INTO users(email, password, name, role) VALUES($1,$2,$3,$4) RETURNING id,email,name,role`;
    const { rows } = await pool.query(q, [email, hashed, name || null, role || 'user']);
    return res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'email already exists' });
    throw e;
  }
}

export async function login(req: any, res: any) {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}

export async function me(req: any, res: any) {
  res.json({ user: req.user });
}


// create admin user if not exists (email: admin@vid.local, password: admin)
//import bcrypt from 'bcrypt';
export async function ensureAdmin() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id FROM users WHERE email=$1', ['admin@vid.local']);
    if (res.rowCount === 0) {
      const hashed = await bcrypt.hash('admin', 10);
      await client.query("INSERT INTO users(email,password,name,role) VALUES($1,$2,$3,$4)", ['admin@vid.local', hashed, 'Admin', 'admin']);
      console.log('Admin user created: admin@vid.local / admin');
    }
  } finally {
    client.release();
  }
}
