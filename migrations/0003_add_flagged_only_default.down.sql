-- Rollback for 0003_add_flagged_only_default.sql
ALTER TABLE user_preferences DROP COLUMN IF EXISTS flagged_only_default;
