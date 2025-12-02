-- Migration 0003: add flagged_only_default column to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS flagged_only_default boolean NOT NULL DEFAULT false;