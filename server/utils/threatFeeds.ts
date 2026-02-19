
import { storage } from '../storage';

const FEEDS = [
  {
    name: 'FireHOL_Level1',
    url: 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset',
    description: 'FireHOL Level 1 (Aggregated proprietary/cybercrime lists)'
  }
];

export async function updateThreatFeeds() {
  console.log('[ThreatFeeds] Starting update...');
  let totalAdded = 0;

  for (const feed of FEEDS) {
    try {
      console.log(`[ThreatFeeds] Fetching ${feed.name}...`);
      const response = await fetch(feed.url);
      if (!response.ok) throw new Error(`Failed to fetch ${feed.url}: ${response.statusText}`);
      
      const text = await response.text();
      const lines = text.split('\n');
      const ips: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // Accept both exact IPs and CIDRs
        if (trimmed.includes('/') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
            ips.push(trimmed);
        }
      }

      console.log(`[ThreatFeeds] ${feed.name}: Found ${ips.length} IPs. Updating database...`);
      if (ips.length > 0) {
        await storage.bulkUpdateIpBlocklist(ips, feed.name);
      }
      totalAdded += ips.length;
      console.log(`[ThreatFeeds] ${feed.name}: Updated successfully.`);

    } catch (error) {
      console.error(`[ThreatFeeds] Failed to update ${feed.name}:`, error);
    }
  }

  console.log(`[ThreatFeeds] Update complete. Total IPs in blocklist: ${totalAdded}`);
  return { success: true, count: totalAdded };
}
