
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { eventSources } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function main() {
  console.log('--- REASSIGNING AGENT OWNER ---');
  
  // The User ID we want to own the data (The one you are likely logged in as)
  // Usually 'demo' in development environments
  const TARGET_USER_ID = 'demo'; 
  
  // The Agent's current API Key Hash prefix from previous logs:
  // "Source 'Network Monitoring Agent' ... belongs to User: unknown (ID: vvY...)"
  const SOURCE_NAME = 'Network Monitoring Agent';

  const result = await db.update(eventSources)
    .set({ userId: TARGET_USER_ID })
    .where(eq(eventSources.name, SOURCE_NAME))
    .returning();

  if (result.length > 0) {
      console.log(`Successfully moved '${SOURCE_NAME}' to User ID: ${TARGET_USER_ID}`);
      console.log('Now the dashboard for "demo" user will see the agent data.');
  } else {
      console.error('Could not find the event source to move.');
  }
  
  await pool.end();
}

main().catch(async (e) => {
    console.error(e);
    await pool.end();
});
