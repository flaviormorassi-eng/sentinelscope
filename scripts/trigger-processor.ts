
import 'dotenv/config';
import { runEventProcessor } from '../server/eventProcessor';

async function main() {
  console.log('Triggering event processor manually...');
  try {
    await runEventProcessor();
    console.log('Event processor finished successfully.');
  } catch (error) {
    console.error('Error running event processor:', error);
    process.exit(1);
  }
  process.exit(0);
}

main();
