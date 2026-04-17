-- v36 — install reminder tracking column
-- Idempotent. Used by /api/cron/install-reminder to avoid sending the
-- 24h "you haven't installed yet" email more than once per user.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pwa_reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_pwa_reminder_target
  ON profiles (created_at)
  WHERE pwa_installed_at IS NULL AND pwa_reminded_at IS NULL;
