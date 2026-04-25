-- v47 — Security + performance audit fixes (2026-04-25)
--
-- Tied to the dual security/performance audit in
-- ~/.claude/projects/C--Users-dnawa/memory/ (Claude Code session
-- 2026-04-25). Three independent changes bundled because each is
-- small and they land together in one push.
--
-- 1. rewards_businesses.submitted_by_whatsapp
--    Previously the public /api/negocios/claim endpoint wrote a
--    submitter-supplied whatsapp number directly to the live
--    `whatsapp` column — anyone could overwrite the contact number
--    on any unclaimed listing. Now the route writes to this new
--    column instead, which the admin approval flow promotes to
--    `whatsapp` after verification.
--
-- 2. idx_wait_time_readings_recorded_at
--    /api/predict, /api/ports/trends, /api/cron/send-alerts and
--    /api/ports/[id]/hourly all filter `wait_time_readings` by
--    recorded_at. Today the only indexes cover (hour_of_day, port_id)
--    and (dow, hour, port_id), so every recorded_at filter falls to
--    a sequential scan. At 230k rows it's ~50-200ms; at 1M rows
--    (3-month projected scale) it's 500-2000ms per call.
--
-- 3. idx_crossing_reports_port_created_active
--    /api/ports blends recent crossing_reports into the wait-time
--    payload on every call (the home page's main data path).
--    Existing indexes are direction-prefixed and don't support a
--    WHERE clause that doesn't filter direction. Partial index on
--    (port_id, created_at DESC) WHERE hidden_at IS NULL keeps the
--    index small while covering the hot query.
--
-- 4. DROP FUNCTION exec_sql
--    SECURITY DEFINER bootstrap function used during early
--    migration tooling. Since `npm run apply-migration` now hits
--    the Supabase Management API directly, exec_sql is dead weight
--    that any future admin route is one `db.rpc('exec_sql', ...)`
--    call away from turning into total-DB-control. Dropping it
--    removes the persistent footgun.

BEGIN;

-- 1) New column for staged whatsapp submissions
ALTER TABLE rewards_businesses
  ADD COLUMN IF NOT EXISTS submitted_by_whatsapp TEXT;

-- 2) Recorded_at index on wait_time_readings
CREATE INDEX IF NOT EXISTS idx_wait_time_readings_recorded_at
  ON wait_time_readings (recorded_at DESC);

-- 3) Partial index on crossing_reports hot path
CREATE INDEX IF NOT EXISTS idx_crossing_reports_port_created_active
  ON crossing_reports (port_id, created_at DESC)
  WHERE hidden_at IS NULL;

-- 4) Drop the SECURITY DEFINER exec_sql RPC
DROP FUNCTION IF EXISTS public.exec_sql(text);

COMMIT;
