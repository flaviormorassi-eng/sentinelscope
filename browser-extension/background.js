// SentinelScope Background Service Worker - Robust V2

let apiKey = null;
let apiUrl = null;
let isEnabled = false;
// Reduced batch size for immediate feedback during development/testing
const BATCH_SIZE = 1; 
const FLUSH_ALARM = 'flushEvents';
const REFRESH_ALARM = 'refreshBlocklist';

// 1. Initialization
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.5 }); // Flush every 30s
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 2.0 });
});

chrome.runtime.onStartup.addListener(() => {
  loadConfig();
});

// Load config immediately
loadConfig();

function loadConfig() {
  chrome.storage.local.get(['apiKey', 'apiUrl', 'isEnabled'], (result) => {
    apiKey = result.apiKey || null;
    apiUrl = result.apiUrl || null;
    isEnabled = result.isEnabled || false;
    
    if (isEnabled && apiKey && apiUrl) {
      console.log('SentinelScope Monitor active');
      updateBlockRules();
    }
  });
}

// 2. Event Listeners
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiKey) apiKey = changes.apiKey.newValue;
  if (changes.apiUrl) apiUrl = changes.apiUrl.newValue;
  if (changes.isEnabled) isEnabled = changes.isEnabled.newValue;
  
  if (isEnabled && apiKey && apiUrl) {
    updateBlockRules();
    // Re-create alarms in case they were cleared
    chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.5 });
  } else {
    // If disabled, maybe clear rules?
    updateBlockRules();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    flushQueue();
  } else if (alarm.name === REFRESH_ALARM) {
    updateBlockRules();
  }
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  // Basic filtering
  if (!details.url || details.url.startsWith('chrome') || details.url.startsWith('about')) return;
  
  capturePageVisit(details);
});

// 3. Core Logic

async function capturePageVisit(details) {
  if (!isEnabled || !apiKey || !apiUrl) return;

  try {
    const url = new URL(details.url);
    const event = {
      domain: url.hostname,
      fullUrl: url.href,
      ipAddress: null,
      browser: getBrowserName(),
      protocol: url.protocol.replace(':', ''),
      timestamp: Date.now()
    };

    // Atomic-ish push to storage
    const data = await chrome.storage.local.get('eventQueue');
    const queue = data.eventQueue || [];
    
    // De-duplicate: simple check if last event is same URL within last 2s
    const last = queue[queue.length - 1];
    if (last && last.fullUrl === event.fullUrl && (event.timestamp - last.timestamp < 2000)) {
       return; // Skip duplicate
    }

    queue.push(event);
    await chrome.storage.local.set({ eventQueue: queue });
    
    // Update badge
    chrome.action.setBadgeText({ text: queue.length.toString() });
    
    // If batch size met, flush immediately
    if (queue.length >= BATCH_SIZE) {
        flushQueue();
    }

  } catch (e) {
    console.error("Capture error:", e);
  }
}

async function flushQueue() {
  if (!isEnabled || !apiKey || !apiUrl) return;

  const data = await chrome.storage.local.get('eventQueue');
  const queue = data.eventQueue || [];
  if (queue.length === 0) return;

  const batch = queue.slice(0, BATCH_SIZE);
  console.log(`[Flush] Sending ${batch.length} events...`);

  try {
    const cleanUrl = getCleanBaseUrl(apiUrl);
    const targetUrl = `${cleanUrl}/api/browsing/ingest`;

    // 5s timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ events: batch }),
      signal: controller.signal
    });
    clearTimeout(id);

    if (response.ok) {
      // Remove the items we sent
      const currentData = await chrome.storage.local.get('eventQueue');
      const currentQueue = currentData.eventQueue || [];
      // Remove N items from head
      const nextQueue = currentQueue.slice(batch.length);
      await chrome.storage.local.set({ eventQueue: nextQueue });
      
      // Update badge
      if (nextQueue.length === 0) {
        chrome.action.setBadgeText({ text: '' });
      } else {
        chrome.action.setBadgeText({ text: nextQueue.length.toString() });
      }

      // Check for blocklist updates in response
      const json = await response.json();
      if (json.domains) {
        updateDynamicRulesFromDomains(json.domains);
      }

    } else if (response.status === 403) {
      console.warn("Auth failed");
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  } catch (e) {
    console.error("Flush failed:", e);
  }
}

// 4. Helpers & Blocking

function getBrowserName() {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Edg/')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome/')) return 'Google Chrome';
  if (userAgent.includes('Firefox/')) return 'Mozilla Firefox';
  if (userAgent.includes('Safari/')) return 'Safari';
  return 'Unknown Browser';
}

function getCleanBaseUrl(rawUrl) {
    if (!rawUrl) return null;
    let cleanUrl = rawUrl.trim();
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    
    // Auto-fix localhost IPv6 issues by forcing IPv4
    cleanUrl = cleanUrl.replace('localhost', '127.0.0.1');
    
    if (cleanUrl.endsWith('/dashboard')) cleanUrl = cleanUrl.replace('/dashboard', '');
    if (cleanUrl.endsWith('/network-activity')) cleanUrl = cleanUrl.replace('/network-activity', '');
    if (cleanUrl.endsWith('/settings')) cleanUrl = cleanUrl.replace('/settings', '');
    
    // Ensure protocol
    if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'http://' + cleanUrl;
    }
    
    return cleanUrl;
}

async function getExistingRuleIds() {
    try {
        const rules = await chrome.declarativeNetRequest.getDynamicRules();
        return rules.map(rule => rule.id);
    } catch (e) {
        console.warn("Could not get existing rules:", e);
        return [];
    }
}

async function updateDynamicRulesFromDomains(domains) {
    try {
        const rules = domains.map((domain, index) => ({
            id: index + 1,
            priority: 1,
            action: { type: 'block' },
            condition: { 
                urlFilter: `||${domain}`, 
                resourceTypes: ['main_frame', 'sub_frame'] 
            }
        }));

        if (rules.length > 4500) rules.length = 4500;

        const existingIds = await getExistingRuleIds();
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingIds,
            addRules: rules
        });
        console.log(`[Blocklist] Applied ${rules.length} rules`);
    } catch (e) {
        console.error("Blocking update failed", e);
    }
}

async function updateBlockRules() {
    if (!isEnabled || !apiKey || !apiUrl) {
        const ids = await getExistingRuleIds();
        if (ids.length > 0) {
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
        }
        return;
    }

    try {
        const base = getCleanBaseUrl(apiUrl);
        const endpoint = `${base}/api/browsing/blocklist`;
        
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(endpoint, {
            signal: controller.signal,
            headers: { 'x-api-key': apiKey }
        });
        clearTimeout(id);

        if (!response.ok) return;

        const data = await response.json();
        if (data.domains) {
            updateDynamicRulesFromDomains(data.domains);
        }
    } catch (e) {
        console.error("Blocklist sync error", e);
    }
}

// 5. Setup Messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStatus') {
    chrome.storage.local.get('eventQueue', (data) => {
       const q = data.eventQueue || [];
       sendResponse({
         isEnabled,
         hasConfig: !!(apiKey && apiUrl),
         queueSize: q.length
       });
    });
    return true; 
  } else if (message.action === 'sendNow') {
    flushQueue().then(() => sendResponse({ success: true }));
    return true;
  }
});
