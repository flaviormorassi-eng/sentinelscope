-- Revert DNS policy preferences columns

ALTER TABLE "user_preferences"
  DROP COLUMN IF EXISTS "dns_detection_enabled",
  DROP COLUMN IF EXISTS "trusted_dns_resolvers";
