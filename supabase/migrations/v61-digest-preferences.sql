-- v61: digest preferences (per-user retro email cadence)
--
-- Replaces blanket "all operators get a Sunday email" with user-tailored
-- cadence: off | weekly | biweekly | monthly. Default 'weekly' for
-- backward-compat with the existing /api/cron/weekly-retrospective flow.
--
-- digest_last_sent_at is the gate the cron uses to decide "is this user
-- due this cycle?" — we update it after a successful Resend send.
--
-- Idempotent. Safe to re-run.

BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS digest_cadence TEXT NOT NULL DEFAULT 'weekly'
    CHECK (digest_cadence IN ('off','weekly','biweekly','monthly'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS digest_last_sent_at TIMESTAMPTZ;

COMMIT;
