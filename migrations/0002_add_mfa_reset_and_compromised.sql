-- Incremental migration: add MFA reset timestamp and compromised flag
ALTER TABLE user_mfa
  ADD COLUMN IF NOT EXISTS mfa_last_reset_at timestamp;

ALTER TABLE webauthn_credentials
  ADD COLUMN IF NOT EXISTS compromised boolean NOT NULL DEFAULT false;
