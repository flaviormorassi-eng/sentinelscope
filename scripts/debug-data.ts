
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { users, eventSources, browsingActivity } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function main() {
  console.log('--- DEBUGGING DATA VISIBILITY ---');
  
  // 1. Check Event Source Owner
  // The key we are using hash starts with 'ad25' (sha256 of '0221...')? 
  // Let's just list all sources.
  
  const sources = await db.select().from(eventSources);
  console.log(`\nEvent Sources (${sources.length}):`);
  for (const s of sources) {
      const u = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
      const email = u[0]?.email || 'unknown';
      console.log(` - Source "${s.name}" (ID: ${s.id}) belongs to User: ${email} (ID: ${s.userId})`);
  }

  // 2. Check Browsing Activity Owners
  const activities = await db.select().from(browsingActivity).orderBy(desc(browsingActivity.detectedAt)).limit(5);
  console.log(`\nLatest Browsing Activity (${activities.length}):`);
  for (const a of activities) {
      console.log(` - [${a.detectedAt}] owned by User ID: ${a.userId} | Domain: ${a.domain}`);
  }

  // 3. List all users to help user identify who they need to be logged in as
  const allUsers = await db.select().from(users);
  console.log(`\nAll Users (${allUsers.length}):`);
  for (const u of allUsers) {
      console.log(` - Email: ${u.email}, ID: ${u.id}`);
  }

  await pool.end();
}

main().catch(async (e) => {
    console.error(e);
    await pool.end();
});
