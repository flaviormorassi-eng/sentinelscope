
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
    console.log('--- ENABLING MONITORING (ALL USERS) ---');

    const allUsers = await db.select().from(users);
    if (allUsers.length === 0) {
        console.log('No users found.');
        process.exit(1);
    }

    let created = 0;
    let updated = 0;
    for (const user of allUsers) {
        const prefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id));

        if (prefs.length === 0) {
            await db.insert(userPreferences).values({
                id: randomUUID(),
                userId: user.id,
                browsingMonitoringEnabled: true,
                browsingHistoryEnabled: true,
                browsingConsentGivenAt: new Date(),
                monitoringMode: 'real',
                alertThreshold: 'medium',
                emailNotifications: true,
                pushNotifications: true,
            });
            created++;
            console.log(`Created preferences for ${user.email} (${user.id})`);
            continue;
        }

        await db.update(userPreferences)
            .set({
                browsingMonitoringEnabled: true,
                browsingHistoryEnabled: true,
                browsingConsentGivenAt: new Date(),
                monitoringMode: 'real',
            })
            .where(eq(userPreferences.userId, user.id));
        updated++;
        console.log(`Updated preferences for ${user.email} (${user.id})`);
    }

    console.log(`SUCCESS: Monitoring enabled for all users. created=${created} updated=${updated}`);
  await pool.end();
}

main().catch(async (e) => {
    console.error(e);
    await pool.end();
});
