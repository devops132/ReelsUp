import { pool } from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

export async function register(req: any, res: any) {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  const hashed = await bcrypt.hash(password, 10);
  try {
    // Always create regular users through this endpoint to avoid privilege escalation
    const q = `INSERT INTO users(email, password, name, role) VALUES($1,$2,$3,$4) RETURNING id,email,name,role`;
    const { rows } = await pool.query(q, [email, hashed, name || null, 'user']);
    return res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'email already exists' });
    throw e;
  }
}

export async function login(req: any, res: any) {
  const { email, password } = req.body;
  console.log("[%s] POST /auth/login %s", new Date().toISOString(), email);

  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user) {
    console.warn("[%s] Login failed for %s: user not found", new Date().toISOString(), email);
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    console.warn("[%s] Login failed for %s: bad password", new Date().toISOString(), email);
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  console.log("[%s] Login success for %s", new Date().toISOString(), email);
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
