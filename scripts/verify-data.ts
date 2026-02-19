
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { browsingActivity } from '../shared/schema';
import { eq, count } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function verify() {
  console.log("--- VERIFYING DATA ---");
  try {
    const result = await db.select({ count: count() })
      .from(browsingActivity)
      .where(eq(browsingActivity.userId, "demo"));
      
    console.log(`BROWSING RECORDS COUNT: ${result[0].count}`);
    
    if (result[0].count > 0) {
      const recent = await db.select()
        .from(browsingActivity)
        .where(eq(browsingActivity.userId, "demo"))
        .limit(1);
      console.log(`Example: ${recent[0].domain} (${recent[0].fullUrl})`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

verify();
