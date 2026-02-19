
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { users, userPreferences } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function main() {
  console.log('--- ENABLING MONITORING ---');
  
  // 1. Find the user attached to the agent
  // We know the ID from previous logs: vvY2qUBOu0TtrsE9IWoh5mizCf82
  // Or we create a query to find them.
  const targetId = 'vvY2qUBOu0TtrsE9IWoh5mizCf82'; 
  
  // Or grab the first user
  const allUsers = await db.select().from(users).limit(1);
  if (allUsers.length === 0) {
      console.log('No user found.'); 
      process.exit(1); 
  }
  
  const user = allUsers[0];
  console.log(`Target User: ${user.email} (${user.id})`);

  // 2. Get prefs
  const prefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id));
  
  if (prefs.length === 0) {
      console.log('No preferences found. Creating defaults with ENABLED monitoring...');
      await db.insert(userPreferences).values({
          id: randomUUID(),
          userId: user.id,
          browsingMonitoringEnabled: true,       // <--- CRITICAL
          browsingHistoryEnabled: true,
          monitoringMode: 'real',
          alertThreshold: 'medium',
          emailNotifications: true,
          pushNotifications: true
      });
  } else {
      console.log('Preferences found. Updating to ENABLED...');
      await db.update(userPreferences)
          .set({ 
              browsingMonitoringEnabled: true,    // <--- CRITICAL
              browsingHistoryEnabled: true,
              monitoringMode: 'real'
          })
          .where(eq(userPreferences.userId, user.id));
  }

  console.log('SUCCESS: Monitoring enabled.');
  await pool.end();
}

main().catch(async (e) => {
    console.error(e);
    await pool.end();
});
