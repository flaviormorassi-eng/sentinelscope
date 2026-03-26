-- Migration to add DNS policy preferences on user settings

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "trusted_dns_resolvers" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "dns_detection_enabled" boolean NOT NULL DEFAULT true;
