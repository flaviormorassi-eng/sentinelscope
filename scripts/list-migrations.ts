#!/usr/bin/env tsx
/**
 * List migrations: shows applied vs pending.
 */
import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set; cannot list applied migrations.');
    process.exit(0);
  }
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).filter(f => /^\d+.*\.sql$/.test(f)).sort() : [];
  const jsonMode = !!process.env.JSON;
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS sentinel_migrations (
      id serial PRIMARY KEY,
      filename text UNIQUE NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum text NOT NULL
    )`);
    const res = await client.query('SELECT filename, applied_at FROM sentinel_migrations ORDER BY filename');
    const applied = new Set(res.rows.map(r => r.filename));
    const pending = files.filter(f => !applied.has(f));
    const pendingOnly = !!process.env.PENDING_ONLY;
    if (jsonMode) {
      if (pendingOnly) {
        console.log(JSON.stringify({ pending }, null, 2));
      } else {
        console.log(JSON.stringify({ applied: res.rows.map(r => ({ filename: r.filename, applied_at: r.applied_at })), pending }, null, 2));
      }
    } else {
      console.log('Applied migrations:');
      res.rows.forEach(r => console.log(`  ✔ ${r.filename} @ ${r.applied_at.toISOString()}`));
      console.log('\nPending migrations:');
      pending.forEach(f => console.log(`  ⏳ ${f}`));
      if (!pending.length) console.log('  (none)');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Failed listing migrations:', e);
  process.exit(1);
});
