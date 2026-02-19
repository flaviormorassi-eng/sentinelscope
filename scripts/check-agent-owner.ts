
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { eventSources } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function checkAgentOwner() {
  console.log("Checking owner of 'Network Monitoring Agent'...");
  try {
    const agents = await db.select()
      .from(eventSources)
      .where(eq(eventSources.name, "Network Monitoring Agent"));

    if (agents.length === 0) {
      console.log("Agent source not found.");
    } else {
      const agent = agents[0];
      console.log(`Agent '${agent.name}' (ID: ${agent.id}) belongs to User ID: ${agent.userId}`);
    }
  } catch (error) {
    console.error("Error checking owner:", error);
  } finally {
    await pool.end();
  }
}

checkAgentOwner();
