
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { browsingActivity } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function checkDemoHistory() {
  console.log("Checking browsing history for 'demo' user...");
  try {
    const history = await db.select()
      .from(browsingActivity)
      .where(eq(browsingActivity.userId, "demo"))
      .orderBy(desc(browsingActivity.detectedAt))
      .limit(5);

    if (history.length === 0) {
      console.log("No history found for 'demo'.");
    } else {
      console.log("Found history for 'demo':");
      history.forEach(h => {
        console.log(`- [${new Date(h.detectedAt).toISOString()}] ${h.domain} (${h.fullUrl})`);
      });
    }
  } catch (error) {
    console.error("Error checking history:", error);
  } finally {
    await pool.end();
  }
}

checkDemoHistory();
