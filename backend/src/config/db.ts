import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { ensureAdmin } from '../controllers/auth.controller.js';

const connectionString = process.env.DATABASE_URL as string;
export const pool = new Pool({ connectionString });

export async function initDb() {
  const client = await pool.connect();
  try {
    // Берём init.sql относительно корня проекта, а не dist/
    const sqlPath = path.resolve(process.cwd(), 'src', 'sql', 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    await client.query(sql);
    console.log('✅ DB initialized from init.sql');

    // Проверим, какие таблицы реально есть
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      ORDER BY table_name;
    `);
    console.log('📋 Tables in DB:', tables.rows.map((r: { table_name: string }) => r.table_name).join(', '));

    // создаём админа после инициализации
    await ensureAdmin();
  } catch (err) {
    console.error('❌ DB init error:', err);
    throw err;
  } finally {
    client.release();
  }
}
