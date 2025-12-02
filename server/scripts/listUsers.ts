#!/usr/bin/env tsx
/**
 * List recent users to find IDs/emails quickly.
 * Usage:
 *   npx tsx server/scripts/listUsers.ts [limit]
 * Defaults to 20 rows.
 */
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { users } from '../../shared/schema';
import { desc } from 'drizzle-orm';

async function main() {
  const limit = parseInt(process.argv[2] || '20', 10);
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in environment. Create a .env with DATABASE_URL=...');
    process.exit(1);
  }

  neonConfig.webSocketConstructor = ws as any;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const rows = await db.select({
      id: users.id,
      email: users.email,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(limit);

    if (rows.length === 0) {
      console.log('No users found.');
      return;
    }

    for (const r of rows) {
      console.log(`${r.id}\t${r.email}\tadmin=${r.isAdmin}\tcreated=${r.createdAt?.toISOString?.() || r.createdAt}`);
    }
  } catch (err) {
    console.error('Listing users failed:', (err as Error).message);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();
