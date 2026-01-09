import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { eventSources } from '../shared/schema';

async function listEventSources() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in environment.');
    process.exit(1);
  }

  // neonConfig.webSocketConstructor = ws as any;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const sources = await db.select().from(eventSources);
    console.log('Found', sources.length, 'event sources:');
    sources.forEach(source => {
      console.log(`- ID: ${source.id}, Name: ${source.name}, Key: ${source.apiKey}, Active: ${source.isActive}`);
    });
  } catch (error) {
    console.error('Error listing event sources:', error);
  }
  process.exit(0);
}

listEventSources();
