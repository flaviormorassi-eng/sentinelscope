-- Migration to add newsletter_subscriptions table

CREATE TABLE IF NOT EXISTS "newsletter_subscriptions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
