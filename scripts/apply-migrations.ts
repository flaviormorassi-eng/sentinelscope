#!/usr/bin/env tsx
/**
 * Automated migrations runner.
 *
 * Applies all *.sql files in ./migrations in lexicographical order inside individual transactions,
 * recording applied filenames in a tracking table so re-runs are idempotent.
 *
 * Tracking table: sentinel_migrations(id serial pk, filename text unique, applied_at timestamptz default now(), checksum text)
 *
 * Checksums (SHA256) are stored; if a filename exists but checksum changed, we warn and skip (manual intervention needed).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory missing:', migrationsDir);
    process.exit(1);
  }
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.match(/^\d+.*\.sql$/))
    .sort();
  if (!files.length) {
    console.log('No migration files found.');
    return;
  }
    const dryRun = !!process.env.DRY_RUN;
  const jsonMode = !!process.env.JSON;
  const results: Array<{filename:string; status:string; checksum?:string; message?:string}> = [];
    if (dryRun) {
      console.log('--- DRY RUN MODE (no changes will be applied) ---');
    }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS sentinel_migrations (
      id serial PRIMARY KEY,
      filename text UNIQUE NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum text NOT NULL
    )`);

    const existingRes = await client.query('SELECT filename, checksum FROM sentinel_migrations');
    const existing = new Map(existingRes.rows.map(r => [r.filename, r.checksum]));

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const prevChecksum = existing.get(file);
      if (prevChecksum) {
        if (prevChecksum !== checksum) {
          const msg = `Migration file '${file}' content changed after application. Skipping. (stored=${prevChecksum} current=${checksum})`;
          console.warn('WARNING:', msg);
          results.push({ filename: file, status: 'warn-changed', checksum, message: msg });
        } else {
          console.log(`SKIP: '${file}' already applied.`);
          results.push({ filename: file, status: 'skipped', checksum });
        }
        continue;
      }
      if (dryRun) {
        console.log(`[DRY] Would apply '${file}' (checksum ${checksum.slice(0,8)}...)`);
        results.push({ filename: file, status: 'dry', checksum });
        continue;
      }
      console.log(`Applying '${file}'...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO sentinel_migrations(filename, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        console.log(`Applied '${file}'.`);
        results.push({ filename: file, status: 'applied', checksum });
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`Failed applying '${file}':`, err.message);
        results.push({ filename: file, status: 'error', checksum, message: err.message });
        process.exitCode = 1;
        break; // stop further migrations
      }
    }
    if (jsonMode) {
      console.log(JSON.stringify({ dryRun, results }, null, 2));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Fatal migrations runner error:', e);
  process.exit(1);
});
