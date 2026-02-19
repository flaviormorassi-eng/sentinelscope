
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { eventSources, users, browsingActivity } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function main() {
  console.log('--- USERS ---');
  const allUsers = await db.select().from(users);
  allUsers.forEach(u => {
      console.log(`User: ${u.email} - ID: ${u.id}`);
  });

  console.log('\n--- EVENT SOURCES ---');
  const allSources = await db.select().from(eventSources);
  allSources.forEach(s => {
      console.log(`Source: ${s.name} - UserID: ${s.userId} - Hash: ${s.apiKeyHash.substring(0, 10)}...`);
  });

  console.log('\n--- BROWSING ACTIVITY (Latest 5) ---');
  const activity = await db.select().from(browsingActivity).orderBy(desc(browsingActivity.detectedAt)).limit(5);
  activity.forEach(a => {
      console.log(`[${a.detectedAt}] UserID: ${a.userId} - ${a.title} (${a.domain})`);
  });

  process.exit(0);
}

main().catch(console.error);
