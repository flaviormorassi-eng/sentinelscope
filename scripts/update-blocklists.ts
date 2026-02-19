
import 'dotenv/config'; // Load env vars
import { updateThreatFeeds } from '../server/utils/threatFeeds';

// Run the update
console.log('Starting blocklist update...');
updateThreatFeeds()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error updating blocklists:', err);
    process.exit(1);
  });
