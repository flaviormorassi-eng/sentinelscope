
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { browsingActivity } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function checkDomains() {
  console.log("--- CHECKING RESOLVED DOMAINS ---");
  try {
    const recent = await db.select()
      .from(browsingActivity)
      .where(eq(browsingActivity.userId, "demo"))
      .orderBy(desc(browsingActivity.detectedAt))
      .limit(10);
      
    if (recent.length === 0) {
        console.log("No data found.");
        return;
    }

    recent.forEach(r => {
        console.log(`[${r.detectedAt.toISOString()}] Domain: ${r.domain} | URL: ${r.fullUrl}`);
    });

  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkDomains();
