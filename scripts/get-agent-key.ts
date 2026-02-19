
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { eventSources } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function getAgentKey() {
  try {
    const agents = await db.select()
      .from(eventSources)
      .where(eq(eventSources.name, "Network Monitoring Agent"));

    if (agents.length > 0) {
      console.log(`AGENT_KEY=${agents[0].secretKey}`);
    } else {
      console.log("AGENT_KEY_NOT_FOUND");
    }
  } catch (error) {
    console.error("Error checking key:", error);
  } finally {
    await pool.end();
  }
}

getAgentKey();
