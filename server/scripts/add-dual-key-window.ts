#!/usr/bin/env tsx
/**
 * Adds dual-key rotation columns to event_sources if not present.
 * Columns:
 *  - secondary_api_key_hash varchar(64)
 *  - rotation_expires_at timestamp
 *
 * Usage:
 *   npx dotenv -e .env -- tsx server/scripts/add-dual-key-window.ts
 */
// pg is CommonJS; in ESM we import default and destructure
import pg from 'pg';
const { Client } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Create a .env with DATABASE_URL=...');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Add columns if they do not exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'event_sources' AND column_name = 'secondary_api_key_hash'
        ) THEN
          ALTER TABLE event_sources ADD COLUMN secondary_api_key_hash varchar(64);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'event_sources' AND column_name = 'rotation_expires_at'
        ) THEN
          ALTER TABLE event_sources ADD COLUMN rotation_expires_at timestamp;
        END IF;
      END $$;
    `);
    console.log('Dual-key rotation columns ensured.');
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exit(2);
  } finally {
    await client.end();
  }
}

main();
