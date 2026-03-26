-- Migration to add soc_case_events table for case timeline history

CREATE TABLE IF NOT EXISTS "soc_case_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "incident_id" varchar NOT NULL,
  "event_type" text NOT NULL,
  "actor_id" varchar REFERENCES "users"("id"),
  "from_value" text,
  "to_value" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "soc_case_events_user_incident_created_idx"
  ON "soc_case_events" ("user_id", "incident_id", "created_at");
