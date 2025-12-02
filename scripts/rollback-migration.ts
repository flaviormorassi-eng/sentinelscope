#!/usr/bin/env tsx
/**
 * Rollback a previously applied migration using its accompanying .down.sql file.
 * Usage: MIGRATION=0003_add_flagged_only_default.sql npm run db:rollback
 * Emits JSON if JSON=1.
 */
import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  const { DATABASE_URL, MIGRATION } = process.env;
  const jsonMode = !!process.env.JSON;
  if (!DATABASE_URL) {
    const msg = 'DATABASE_URL not set';
    if (jsonMode) console.log(JSON.stringify({ error: msg })); else console.error(msg);
    process.exit(1);
  }
  if (!MIGRATION) {
    const msg = 'MIGRATION env var required (e.g. MIGRATION=0003_add_flagged_only_default.sql)';
    if (jsonMode) console.log(JSON.stringify({ error: msg })); else console.error(msg);
    process.exit(1);
  }
  if (MIGRATION.startsWith('0001')) {
    const msg = 'Baseline migration rollback is disabled.';
    if (jsonMode) console.log(JSON.stringify({ error: msg })); else console.error(msg);
    process.exit(1);
  }
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const targetFile = path.join(migrationsDir, MIGRATION);
  if (!fs.existsSync(targetFile)) {
    const msg = `Migration file not found: ${MIGRATION}`;
    if (jsonMode) console.log(JSON.stringify({ error: msg })); else console.error(msg);
    process.exit(1);
  }
  const downFile = path.join(migrationsDir, `${MIGRATION.replace(/\.sql$/, '')}.down.sql`);
  if (!fs.existsSync(downFile)) {
    const msg = `Down file not found: ${path.basename(downFile)}`;
    if (jsonMode) console.log(JSON.stringify({ error: msg })); else console.error(msg);
    process.exit(1);
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
    const appliedRes = await client.query('SELECT filename FROM sentinel_migrations WHERE filename=$1', [MIGRATION]);
    if (appliedRes.rowCount === 0) {
      const msg = `Migration '${MIGRATION}' not recorded as applied.`;
      if (jsonMode) console.log(JSON.stringify({ error: msg })); else console.error(msg);
      process.exit(1);
    }
    const downSql = fs.readFileSync(downFile, 'utf8');
    await client.query('BEGIN');
    await client.query(downSql);
    await client.query('DELETE FROM sentinel_migrations WHERE filename=$1', [MIGRATION]);
    await client.query('COMMIT');
    const outcome = { rolledBack: MIGRATION };
    if (jsonMode) console.log(JSON.stringify(outcome, null, 2)); else console.log(`Rolled back ${MIGRATION}`);
  } catch (err: any) {
    await client.query('ROLLBACK');
    const msg = `Rollback failed: ${err.message}`;
    if (jsonMode) console.log(JSON.stringify({ error: msg })); else console.error(msg);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  const msg = `Fatal rollback error: ${e.message}`;
  if (process.env.JSON) console.log(JSON.stringify({ error: msg })); else console.error(msg);
  process.exit(1);
});
