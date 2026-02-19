
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { browsingActivity } from '../shared/schema';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function main() {
  console.log('--- PURGING BROWSING HISTORY ---');
  
  // Delete all rows from browsing_activity
  // In a real production app we might filter by user, but for this 'clean slate' request 
  // we will wipe it all to ensure no fake demo data remains.
  
  const result = await db.delete(browsingActivity).returning();
  
  console.log(`Deleted ${result.length} browsing history records.`);
  console.log('The history is now clean. Real agent data will be the only thing visible.');
  
  await pool.end();
}

main().catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
});
