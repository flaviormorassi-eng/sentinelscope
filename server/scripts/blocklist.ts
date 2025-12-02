#!/usr/bin/env tsx
/**
 * Manage IP blocklist without admin API access.
 * Usage:
 *   npx tsx server/scripts/blocklist.ts add <IP> [reason]
 *   npx tsx server/scripts/blocklist.ts check <IP>
 *   npx tsx server/scripts/blocklist.ts remove <IP>
 */
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { ipBlocklist } from '../../shared/schema';
import { and, desc, eq } from 'drizzle-orm';

async function main() {
  const [cmd, arg1, ...rest] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in environment. Create a .env with DATABASE_URL=...');
    process.exit(1);
  }
  if (!cmd || !['add','check','remove'].includes(cmd)) {
    console.error('Usage: blocklist.ts <add|check|remove> <IP> [reason]');
    process.exit(1);
  }
  const ip = arg1;
  if (!ip) {
    console.error('ERROR: Missing <IP>');
    process.exit(1);
  }

  neonConfig.webSocketConstructor = ws as any;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    if (cmd === 'add') {
      const reason = rest.join(' ') || null;
      // Check if already exists
      const existing = await db.select().from(ipBlocklist).where(eq(ipBlocklist.ipAddress, ip));
      if (existing.length > 0) {
        console.log(`Already blocklisted: ${ip}`);
      } else {
        await db.insert(ipBlocklist).values({ ipAddress: ip, reason });
        console.log(`Added to blocklist: ${ip}${reason ? ' ('+reason+')' : ''}`);
      }
    } else if (cmd === 'check') {
      const existing = await db.select().from(ipBlocklist).where(eq(ipBlocklist.ipAddress, ip));
      console.log(JSON.stringify({ ip, blocked: existing.length > 0 }));
    } else if (cmd === 'remove') {
      const existing = await db.select().from(ipBlocklist).where(eq(ipBlocklist.ipAddress, ip));
      if (existing.length === 0) {
        console.log(`Not found in blocklist: ${ip}`);
      } else {
        await db.delete(ipBlocklist).where(eq(ipBlocklist.ipAddress, ip));
        console.log(`Removed from blocklist: ${ip}`);
      }
    }
  } catch (err) {
    console.error('Blocklist command failed:', (err as Error).message);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();
