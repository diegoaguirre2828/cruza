-- v88: B2B profile columns
-- Adds three columns to profiles to track B2B onboarding state and broker preferences.
--   b2b_onboarded_at    — timestamp when the user completed B2B onboarding flow
--   b2b_commodity_type  — free-text commodity type entered during onboarding
--   b2b_watched_ports   — array of port codes the broker wants to monitor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS b2b_onboarded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS b2b_commodity_type  TEXT,
  ADD COLUMN IF NOT EXISTS b2b_watched_ports   TEXT[] DEFAULT '{}';
