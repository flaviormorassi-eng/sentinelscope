
import 'dotenv/config';
import { storage } from "../server/storage";
import { eventSources } from "../shared/schema";
import { eq } from "drizzle-orm";
import { hashApiKey } from "../server/utils/security";

async function main() {
  // Create a temporary test source
  const testKey = "sk_test_" + Math.random().toString(36).substring(7);
  const name = "Test Script Source " + Date.now();
  const hashedKey = hashApiKey(testKey);
  
  const newSource = await storage.createEventSource({
    userId: "demo",
    name: name,
    sourceType: "browsing_extension", // Use correct column name
    isActive: true,
    apiKeyHash: hashedKey,
  });
  
  console.log(`Created Source ID: ${newSource.id}`);
  console.log(`Using API Key: ${testKey}`);
  
  // Now send a request
  const fetch = (await import('node-fetch')).default;
  
  const payload = {
      events: [
          {
              domain: "example-malicious-test.com",
              fullUrl: "https://example-malicious-test.com/login",
              browser: "DebugScript",
              timestamp: Date.now()
          }
      ]
  };
  
  console.log("Sending payload to /api/browsing/ingest...");
  
  const response = await fetch("http://localhost:3001/api/browsing/ingest", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "x-api-key": testKey
      },
      body: JSON.stringify(payload)
  });
  
  const text = await response.text();
  console.log(`Response Status: ${response.status}`);
  console.log(`Response Body: ${text}`);

  process.exit(0);
}

main().catch(console.error);
