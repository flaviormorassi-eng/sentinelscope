#!/usr/bin/env tsx
/**
 * Promote a user to admin without psql access.
 * Usage:
 *   npx tsx server/scripts/promoteAdmin.ts <USER_ID | EMAIL>
 *
 * Requires DATABASE_URL in environment (.env loaded via dev script or manually).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pgPkg from 'pg';
const { Pool } = pgPkg;
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const ident = process.argv[2];
  if (!ident) {
    console.error('ERROR: Missing argument. Provide a user ID or email.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in environment. Create a .env with DATABASE_URL=...');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Accept either ID or email (if it contains '@', treat as email)
    const byEmail = ident.includes('@');
    const existing = byEmail
      ? await db.select().from(users).where(eq(users.email, ident))
      : await db.select().from(users).where(eq(users.id, ident));

    if (existing.length === 0) {
      console.error(`User not found: ${ident}`);
      process.exit(2);
    }
    if (existing[0].isAdmin) {
      console.log('User is already admin. No change made.');
      process.exit(0);
    }
    const targetId = existing[0].id;
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, targetId));
    const updated = await db.select().from(users).where(eq(users.id, targetId));
    console.log('SUCCESS: User promoted to admin:', { id: updated[0].id, isAdmin: updated[0].isAdmin, email: updated[0].email });
  } catch (err) {
    console.error('Promotion failed:', (err as Error).message);
    process.exit(3);
  } finally {
    await pool.end();
  }
}

main();
