-- Add flagged_only_default to user_preferences for UI persistence
ALTER TABLE "user_preferences" 
  ADD COLUMN IF NOT EXISTS "flagged_only_default" boolean NOT NULL DEFAULT false;