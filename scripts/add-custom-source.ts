
import 'dotenv/config';
import { storage } from '../server/storage';
import { hashApiKey } from '../server/utils/security';

async function main() {
  const apiKey = '8a857ae2d657ae297171d4d5b5227642e50651673aade86b41898eaed6c86e43';
  const userId = 'demo'; 

  console.log(`Creating event source with API Key: ${apiKey}`);
  
  const user = await storage.getUser(userId);
  if (!user) {
      console.error(`User ${userId} not found. Please ensure the demo user exists.`);
      process.exit(1);
  }

  const apiKeyHash = hashApiKey(apiKey);
  
  try {
    const source = await storage.createEventSource({
      userId,
      name: 'Custom Source (Manual)',
      sourceType: 'api',
      description: 'Manually added via script',
      apiKeyHash,
      metadata: { manual: true },
    });
    console.log('Event Source Created Successfully!');
    console.log('ID:', source.id);
    console.log('API Key:', apiKey);
  } catch (err: any) {
    if (err.code === '23505') {
        console.log('Event source with this key already exists.');
    } else {
        console.error('Failed to create source:', err);
    }
  }
  process.exit(0);
}

main();
