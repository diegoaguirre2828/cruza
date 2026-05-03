-- v73: dedupe alert_preferences + enforce unique (user_id, port_id, lane_type).
--
-- Bug fix 2026-05-02: /api/alerts POST blindly inserts new rows on every
-- "Activar alerta" tap, so a user who taps the bell sheet twice ends up
-- with multiple identical alert rows. Diego hit this 3x on port 535501
-- without knowing. The cap check is total-per-tier so it doesn't catch
-- intra-port duplicates.
--
-- This migration first deletes existing dupes (keeping the most recent
-- row per (user_id, port_id, lane_type)) so the unique index can be
-- created, then locks the constraint. Companion API change switches the
-- /api/alerts POST to upsert-on-conflict so future taps update the
-- existing row's threshold instead of stacking.

-- 1. Drop existing duplicates: keep the most recent row per (user, port, lane)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, port_id, COALESCE(lane_type, 'vehicle')
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM alert_preferences
)
DELETE FROM alert_preferences ap
USING ranked r
WHERE ap.id = r.id AND r.rn > 1;

-- 2. Enforce uniqueness so re-tap can be detected at the DB layer too
CREATE UNIQUE INDEX IF NOT EXISTS alert_preferences_user_port_lane_uniq
  ON alert_preferences (user_id, port_id, COALESCE(lane_type, 'vehicle'));
