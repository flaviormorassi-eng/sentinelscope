
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { browsingActivity } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function clearData() {
  console.log("Clearing browsing activity for demo user...");
  try {
    await db.delete(browsingActivity).where(eq(browsingActivity.userId, "demo"));
    console.log("Cleared.");
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

clearData();
