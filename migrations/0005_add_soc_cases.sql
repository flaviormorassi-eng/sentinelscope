-- Migration to add soc_cases table for SOC analyst workflow

CREATE TABLE IF NOT EXISTS "soc_cases" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "incident_id" varchar NOT NULL,
  "owner" text,
  "notes" text,
  "case_status" text NOT NULL DEFAULT 'open',
  "sla_due_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "soc_cases_user_incident_unique" UNIQUE ("user_id", "incident_id")
);

CREATE INDEX IF NOT EXISTS "soc_cases_user_updated_idx" ON "soc_cases" ("user_id", "updated_at");
