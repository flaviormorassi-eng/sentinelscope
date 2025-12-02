#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: DATABASE_URL });
  const filePath = path.resolve(process.cwd(), 'migrations/0001_init.sql');
  if (!fs.existsSync(filePath)) {
    console.error('Migration file not found at', filePath);
    process.exit(1);
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    console.log('Applying 0001_init.sql ...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err: any) {
    console.error('Migration failed, rolling back:', err.message);
    await client.query('ROLLBACK');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Fatal migration error:', e);
  process.exit(1);
});
