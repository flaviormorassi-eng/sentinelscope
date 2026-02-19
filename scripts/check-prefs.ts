import 'dotenv/config';
import { storage } from "../server/storage";
import { userPreferences } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Accessing private db property by casting or just using public methods
  // storage.getUserPreferences is public!
  const prefs = await storage.getUserPreferences("demo");
  console.log("User Preferences for 'demo':");
  console.log(JSON.stringify(prefs, null, 2));
  process.exit(0);
}

main().catch(console.error);
