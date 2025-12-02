import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const sql = `
    ALTER TABLE "user_preferences" 
    ADD COLUMN IF NOT EXISTS "flagged_only_default" boolean NOT NULL DEFAULT false;
  `;
  try {
    const res = await pool.query(sql);
    console.log('Migration applied: flagged_only_default ensured on user_preferences');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
