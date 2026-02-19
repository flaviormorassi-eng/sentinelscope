
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { eventSources } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

async function resetAgentKey() {
  console.log("Resetting Network Monitoring Agent API Key...");
  
  const newKey = generateApiKey();
  const newHash = hashApiKey(newKey);
  
  try {
    // Update the key in the database
    const result = await db.update(eventSources)
      .set({ apiKeyHash: newHash })
      .where(eq(eventSources.name, "Network Monitoring Agent"))
      .returning();

    if (result.length === 0) {
      console.log("Agent source not found! Is it named correctly?");
    } else {
      console.log(`Successfully updated agent key for '${result[0].name}'.`);
      console.log(`NEW_API_KEY=${newKey}`);
      
      // Update the python script
      const scriptPath = path.join(process.cwd(), 'examples', 'network-monitoring-agent.py');
      let content = fs.readFileSync(scriptPath, 'utf8');
      
      // key regex replacement
      const keyRegex = /API_KEY = os\.environ\.get\("SentinelScope_API_KEY", "[a-f0-9]+"\)/;
      const newContent = content.replace(keyRegex, `API_KEY = os.environ.get("SentinelScope_API_KEY", "${newKey}")`);
      
      fs.writeFileSync(scriptPath, newContent);
      console.log("Updated examples/network-monitoring-agent.py with new key.");
    }

  } catch (error) {
    console.error("Error updating key:", error);
  } finally {
    await pool.end();
  }
}

resetAgentKey();
