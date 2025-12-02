-- Initial manual migration for MFA and WebAuthn tables
-- Ensures deterministic baseline to bypass drizzle diff bug on complex column additions.
-- Requires gen_random_uuid(): provided by pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- user_mfa: one row per user capturing MFA state and secrets metadata
CREATE TABLE IF NOT EXISTS user_mfa (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE REFERENCES users(id),
  totp_enabled boolean NOT NULL DEFAULT false,
  phone_enabled boolean NOT NULL DEFAULT false,
  totp_secret_hash varchar(128),
  secret_algo text,
  secret_version integer,
  phone_number text,
  phone_verified_at timestamp,
  totp_enabled_at timestamp,
  last_verified_at timestamp,
  disabled_at timestamp,
  phone_pending_number text,
  phone_verification_code_hash varchar(128),
  phone_verification_expires_at timestamp,
  phone_verification_attempts integer NOT NULL DEFAULT 0,
  recovery_code_hashes jsonb,
  recovery_codes_generated_at timestamp,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_mfa_user_id_idx ON user_mfa(user_id);
CREATE INDEX IF NOT EXISTS user_mfa_totp_enabled_idx ON user_mfa(totp_enabled);

-- webauthn_credentials: multiple credentials per user
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  credential_id varchar(256) NOT NULL UNIQUE,
  public_key text NOT NULL,
  sign_count integer NOT NULL DEFAULT 0,
  transports jsonb,
  backup_eligible boolean NOT NULL DEFAULT false,
  backup_state boolean NOT NULL DEFAULT false,
  aaguid varchar(64),
  algorithm integer,
  name varchar(128),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webauthn_user_idx ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS webauthn_credential_idx ON webauthn_credentials(credential_id);

-- End of 0001_init.sql
