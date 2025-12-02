-- Baseline core schema to allow incremental migrations to apply cleanly.
-- This consolidates fundamental tables that other early migrations reference.
-- Safe to run on an empty database; uses IF NOT EXISTS for idempotency of extensions.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id varchar PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text,
  photo_url text,
  subscription_tier text NOT NULL DEFAULT 'individual',
  is_admin boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'en',
  theme text NOT NULL DEFAULT 'dark',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text NOT NULL DEFAULT 'inactive',
  current_period_end timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

-- IP Blocklist
CREATE TABLE IF NOT EXISTS ip_blocklist (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  reason text,
  added_by varchar,
  country_code text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Threats
CREATE TABLE IF NOT EXISTS threats (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  timestamp timestamp NOT NULL DEFAULT now(),
  severity text NOT NULL,
  type text NOT NULL,
  source_ip text NOT NULL,
  source_country text,
  source_city text,
  source_lat text,
  source_lon text,
  target_ip text NOT NULL,
  status text NOT NULL DEFAULT 'detected',
  description text NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  source_url text,
  device_name text,
  threat_vector text
);

-- Threat decisions
CREATE TABLE IF NOT EXISTS threat_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_id varchar NOT NULL REFERENCES threats(id),
  decided_by varchar NOT NULL REFERENCES users(id),
  decision text NOT NULL,
  reason text,
  previous_status text,
  timestamp timestamp NOT NULL DEFAULT now()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  threat_id varchar REFERENCES threats(id),
  timestamp timestamp NOT NULL DEFAULT now(),
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL,
  read boolean NOT NULL DEFAULT false
);

-- User preferences (flagged_only_default added in later migration 0003)
CREATE TABLE IF NOT EXISTS user_preferences (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE REFERENCES users(id),
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  alert_threshold text NOT NULL DEFAULT 'medium',
  monitoring_mode text NOT NULL DEFAULT 'demo',
  trial_started_at timestamp,
  trial_expires_at timestamp,
  browsing_monitoring_enabled boolean NOT NULL DEFAULT false,
  browsing_history_enabled boolean NOT NULL DEFAULT false,
  browsing_consent_given_at timestamp
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id varchar NOT NULL REFERENCES users(id),
  action text NOT NULL,
  target_user_id varchar REFERENCES users(id),
  details text,
  timestamp timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_id_idx ON admin_audit_log(admin_id);

-- Security audit logs
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  event_type text NOT NULL,
  event_category text NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id varchar,
  ip_address text,
  user_agent text,
  status text NOT NULL DEFAULT 'success',
  severity text NOT NULL DEFAULT 'info',
  details jsonb,
  metadata jsonb,
  timestamp timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_audit_logs_user_id_idx ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS security_audit_logs_timestamp_idx ON security_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS security_audit_logs_event_type_idx ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS security_audit_logs_category_idx ON security_audit_logs(event_category);

-- Data retention policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type text NOT NULL UNIQUE,
  retention_days integer NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Event sources
CREATE TABLE IF NOT EXISTS event_sources (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  name text NOT NULL,
  source_type text NOT NULL,
  description text,
  api_key_hash varchar(64) NOT NULL UNIQUE,
  secondary_api_key_hash varchar(64),
  rotation_expires_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  last_heartbeat timestamp,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_sources_user_id_idx ON event_sources(user_id);

-- Raw events
CREATE TABLE IF NOT EXISTS raw_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id varchar NOT NULL REFERENCES event_sources(id),
  user_id varchar NOT NULL REFERENCES users(id),
  raw_data jsonb NOT NULL,
  received_at timestamp NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamp
);
CREATE INDEX IF NOT EXISTS raw_events_processed_idx ON raw_events(processed, received_at);
CREATE INDEX IF NOT EXISTS raw_events_user_id_idx ON raw_events(user_id);

-- Normalized events
CREATE TABLE IF NOT EXISTS normalized_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_event_id varchar REFERENCES raw_events(id),
  source_id varchar NOT NULL REFERENCES event_sources(id),
  user_id varchar NOT NULL REFERENCES users(id),
  event_type text NOT NULL,
  severity text NOT NULL,
  source_ip text,
  destination_ip text,
  source_port integer,
  destination_port integer,
  protocol text,
  action text,
  source_country text,
  source_city text,
  source_lat text,
  source_lon text,
  message text,
  metadata jsonb,
  timestamp timestamp NOT NULL DEFAULT now(),
  is_threat boolean NOT NULL DEFAULT false,
  source_url text,
  device_name text,
  threat_vector text
);
CREATE INDEX IF NOT EXISTS normalized_events_user_timestamp_idx ON normalized_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS normalized_events_is_threat_idx ON normalized_events(is_threat);

-- Threat events
CREATE TABLE IF NOT EXISTS threat_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_event_id varchar NOT NULL REFERENCES normalized_events(id),
  user_id varchar NOT NULL REFERENCES users(id),
  threat_type text NOT NULL,
  severity text NOT NULL,
  confidence integer NOT NULL,
  mitigation_status text NOT NULL DEFAULT 'detected',
  auto_blocked boolean NOT NULL DEFAULT false,
  manually_reviewed boolean NOT NULL DEFAULT false,
  reviewed_by varchar REFERENCES users(id),
  review_notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  reviewed_at timestamp,
  source_url text,
  device_name text,
  threat_vector text
);
CREATE INDEX IF NOT EXISTS threat_events_user_created_idx ON threat_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS threat_events_status_idx ON threat_events(mitigation_status);

-- Threat intelligence matches
CREATE TABLE IF NOT EXISTS intel_matches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_event_id varchar REFERENCES normalized_events(id),
  threat_event_id varchar REFERENCES threat_events(id),
  intel_source text NOT NULL,
  indicator text NOT NULL,
  indicator_type text NOT NULL,
  threat_type text,
  confidence integer,
  metadata jsonb,
  matched_at timestamp NOT NULL DEFAULT now()
);

-- Agent registrations
CREATE TABLE IF NOT EXISTS agent_registrations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  agent_name text NOT NULL,
  agent_type text NOT NULL,
  hostname text,
  ip_address text,
  version text,
  api_key_hash varchar(64) NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  last_heartbeat timestamp,
  metadata jsonb,
  registered_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_registrations_user_id_idx ON agent_registrations(user_id);
CREATE INDEX IF NOT EXISTS agent_registrations_active_idx ON agent_registrations(is_active);

-- Browsing activity
CREATE TABLE IF NOT EXISTS browsing_activity (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  source_id varchar REFERENCES event_sources(id),
  detected_at timestamp NOT NULL DEFAULT now(),
  domain text NOT NULL,
  full_url text,
  url_hash varchar(64),
  ip_address text,
  port integer,
  browser text,
  browser_version text,
  protocol text,
  category text,
  is_flagged boolean NOT NULL DEFAULT false,
  device_name text,
  metadata jsonb
);
CREATE INDEX IF NOT EXISTS browsing_activity_user_detected_idx ON browsing_activity(user_id, detected_at);
CREATE INDEX IF NOT EXISTS browsing_activity_domain_idx ON browsing_activity(domain);
CREATE INDEX IF NOT EXISTS browsing_activity_is_flagged_idx ON browsing_activity(is_flagged);
CREATE INDEX IF NOT EXISTS browsing_activity_browser_idx ON browsing_activity(browser);

-- NOTE: user_mfa & webauthn_credentials created in 0001_init.sql; 0002/0003 extend them.
-- End baseline.