
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { eventSources, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load env
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

async function resolveTargetUserId(): Promise<string> {
  const userIdArg = getArg('--user-id');
  const emailArg = getArg('--email');

  if (userIdArg) {
    const byId = await db.select().from(users).where(eq(users.id, userIdArg)).limit(1);
    if (!byId[0]) {
      throw new Error(`User not found for --user-id=${userIdArg}`);
    }
    return byId[0].id;
  }

  if (emailArg) {
    const all = await db.select().from(users);
    const byEmail = all.find(u => (u.email || '').toLowerCase() === emailArg.toLowerCase());
    if (!byEmail) {
      throw new Error(`User not found for --email=${emailArg}`);
    }
    return byEmail.id;
  }

  // Smart default for dev: prefer `demo` if present.
  const demo = await db.select().from(users).where(eq(users.id, 'demo')).limit(1);
  if (demo[0]) return demo[0].id;

  // If there is exactly one user, use it; otherwise force explicit selection.
  const allUsers = await db.select().from(users);
  if (allUsers.length === 1) return allUsers[0].id;

  if (allUsers.length === 0) {
    const created = await db.insert(users).values({
      id: crypto.randomUUID(),
      displayName: 'Admin User',
      isAdmin: true,
      email: 'admin@localhost.com',
      subscriptionTier: 'enterprise',
    }).returning();
    return created[0].id;
  }

  console.error('Multiple users found. Pass one of:');
  console.error('  --user-id <id>');
  console.error('  --email <email>');
  console.error('\nAvailable users:');
  for (const u of allUsers) {
    console.error(`- ${u.id} (${u.email || u.displayName || 'no-email'})`);
  }
  throw new Error('Ambiguous target user. Refusing to create an orphaned/mismatched agent key.');
}

async function main() {
  console.log('--- Setting up Event Source API Key ---');

  // 1) Resolve target user safely
  const userId = await resolveTargetUserId();
  const targetUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  console.log(`Target user: ${targetUser?.displayName || targetUser?.email || userId} (${userId})`);

  // 2. Generate New Key
  const rawKey = generateApiKey();
  const hashedKey = hashApiKey(rawKey);

  // 3. Create or rotate key for source owned by this user
  const sourceName = 'Network Monitoring Agent';
  const existingForUser = (await db.select().from(eventSources).where(eq(eventSources.userId, userId)))
    .find(s => s.name === sourceName);

  if (existingForUser) {
    await db.update(eventSources)
      .set({
        apiKeyHash: hashedKey,
        isActive: true,
        secondaryApiKeyHash: null,
        rotationExpiresAt: null,
      })
      .where(eq(eventSources.id, existingForUser.id));
    console.log(`Updated existing source: ${existingForUser.id}`);
  } else {
    const created = await db.insert(eventSources).values({
      userId,
      name: sourceName,
      sourceType: 'network_agent',
      description: 'Local python network agent',
      apiKeyHash: hashedKey,
      isActive: true,
    }).returning();
    console.log(`Created source: ${created[0].id}`);
  }

  console.log('\nSUCCESS! Created new API Key:');
  console.log('KEY_START');
  console.log(rawKey);
  console.log('KEY_END');
  console.log('\nSet one of these env vars in your agent runtime:');
  console.log(`export SENTINELSCOPE_API_KEY=${rawKey}`);
  console.log(`export SentinelScope_API_KEY=${rawKey}`);
  
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
