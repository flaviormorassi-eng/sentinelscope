#!/usr/bin/env tsx
/**
 * Mark a changed migration as applied by updating its stored checksum to current file content.
 * Usage: MIGRATION=0003_add_flagged_only_default.sql npm run db:migrate:mark-changed
 * JSON output when JSON=1.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  const { DATABASE_URL, MIGRATION } = process.env;
  const jsonMode = !!process.env.JSON;
  if (!DATABASE_URL) return exitJson(jsonMode, 'DATABASE_URL not set', 1);
  if (!MIGRATION) return exitJson(jsonMode, 'MIGRATION env var required', 1);
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const targetPath = path.join(migrationsDir, MIGRATION);
  if (!fs.existsSync(targetPath)) return exitJson(jsonMode, `Migration file not found: ${MIGRATION}`, 1);
  const sql = fs.readFileSync(targetPath, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT checksum FROM sentinel_migrations WHERE filename=$1', [MIGRATION]);
    if (res.rowCount === 0) {
      return exitJson(jsonMode, `Migration '${MIGRATION}' not recorded as applied.`, 1);
    }
    const oldChecksum = res.rows[0].checksum;
    if (oldChecksum === checksum) {
      return exitJson(jsonMode, 'Checksum unchanged; nothing to update.', 0, { filename: MIGRATION, checksum });
    }
    await client.query('UPDATE sentinel_migrations SET checksum=$1 WHERE filename=$2', [checksum, MIGRATION]);
    if (jsonMode) {
      console.log(JSON.stringify({ filename: MIGRATION, oldChecksum, newChecksum: checksum, status: 'updated' }, null, 2));
    } else {
      console.log(`Updated checksum for ${MIGRATION}\nOld: ${oldChecksum}\nNew: ${checksum}`);
    }
  } catch (err: any) {
    return exitJson(jsonMode, `Failed updating checksum: ${err.message}`, 1);
  } finally {
    client.release();
    await pool.end();
  }
}

function exitJson(json: boolean, message: string, code: number, extra?: any) {
  if (json) {
    console.log(JSON.stringify({ error: code ? message : undefined, message, ...extra }, null, 2));
  } else {
    if (code) console.error(message); else console.log(message);
  }
  process.exit(code);
}

main().catch(e => exitJson(!!process.env.JSON, `Fatal error: ${e.message}`, 1));
