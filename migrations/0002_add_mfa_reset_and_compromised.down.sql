-- Rollback for 0002_add_mfa_reset_and_compromised.sql
-- Drops columns added; data loss warning (irreversible).
ALTER TABLE webauthn_credentials DROP COLUMN IF EXISTS compromised;
ALTER TABLE user_mfa DROP COLUMN IF EXISTS mfa_last_reset_at;
