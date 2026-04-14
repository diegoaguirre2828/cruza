-- =============================================================
-- Cruzar sensor-network schema additions — 2026-04-14
-- =============================================================
-- Paste the whole file into the Supabase SQL editor and run it.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS) so
-- running it twice is safe.
--
-- What this adds:
--   1. New columns on crossing_reports so community reports can
--      capture the sensor-network fields (lane_type, x_ray_active,
--      idle_time_minutes, flow_rate_estimate, first_stop_to_booth,
--      incident_flag, gps_lat/gps_lng, source enum).
--   2. The wait_time_readings(hour_of_day, port_id) index that was
--      missing when the /api/ports historical query took down the
--      site on 2026-04-14 — needed before I re-enable the
--      historical fallback via a separately-cached endpoint.
--   3. Retention guardrail: a function + comment documenting
--      that this data is long-lived. No DELETE jobs allowed.
-- =============================================================

-- ─── 1. crossing_reports new columns ──────────────────────────

-- Lane type the user was in (or observing). Enum-like TEXT so it's
-- easy to extend without a migration. Known values:
--   'standard'   — regular passenger vehicle lane
--   'ready'      — Ready Lane (RFID)
--   'sentri'     — SENTRI / NEXUS
--   'fast'       — FAST (commercial trusted traveler)
--   'pedestrian' — walking lane
--   'commercial' — commercial truck lane
--   'unknown'    — user didn't know / didn't say
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS lane_type TEXT;

-- Whether CBP was running the X-ray / secondary inspection machine
-- at this crossing at the time of report. Huge determinant of wait
-- time. CBP doesn't publish this — community-reported is the moat
-- over any data-only aggregator. Originates from Enrique Rodriguez's
-- FB group insight (project_cruzar_lane_details.md).
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS x_ray_active BOOLEAN;

-- Minutes the user was FULLY STOPPED (not creeping). Different from
-- total wait — a 30-min wait with 25 min creeping is very different
-- from a 30-min wait with 25 min frozen. Useful for modeling flow.
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS idle_time_minutes INTEGER;

-- Estimated cars crossing the booth per minute as observed. Optional,
-- only filled when the user watches the booth. Integer for simplicity.
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS flow_rate_estimate INTEGER;

-- Minutes from the first time the user fully stopped until they
-- reached the inspection booth. Ground-truth wait for flow modeling.
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS first_stop_to_booth_minutes INTEGER;

-- Known incidents observed. Enum-like TEXT:
--   'accident' | 'inspection' | 'k9' | 'booth_closure' | 'weather' | null
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS incident_flag TEXT;

-- User's GPS coordinates at the time of report, for geofence
-- verification. location_confidence already exists as a derived
-- field; this is the raw source so we can recompute confidence
-- thresholds without asking users to re-report.
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION;
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;

-- Where the report came from. Enum-like TEXT:
--   'community'     — user submitted via ReportForm
--   'geofence_auto' — Cruzar auto-prompted while inside the port geofence
--   'sensor'        — future IoT partnership (state DOT camera, etc.)
-- Defaults to 'community' so existing rows stay meaningful.
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'community';

-- Helpful indexes for common query patterns on the new fields.
CREATE INDEX IF NOT EXISTS idx_crossing_reports_lane_type
  ON crossing_reports(lane_type)
  WHERE lane_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crossing_reports_xray
  ON crossing_reports(port_id, created_at DESC)
  WHERE x_ray_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_crossing_reports_incident
  ON crossing_reports(port_id, created_at DESC)
  WHERE incident_flag IS NOT NULL;

-- ─── 2. wait_time_readings hour index ─────────────────────────
-- This is the index whose absence took down cruzar.app on 2026-04-14
-- (MIDDLEWARE_INVOCATION_TIMEOUT cascade when /api/ports filtered on
-- hour_of_day without it). Need this before re-enabling the
-- historical fallback on the hot path.

CREATE INDEX IF NOT EXISTS idx_wait_time_readings_hour_port
  ON wait_time_readings(hour_of_day, port_id)
  WHERE vehicle_wait IS NOT NULL;

-- ─── 3. Retention guardrail ───────────────────────────────────
-- Cruzar's moat is the longitudinal dataset. Diego's directive
-- 2026-04-14: store all sensor data for 3+ years minimum. No
-- aggressive TTL, no 90-day rolling delete. Don't add DELETE jobs
-- against these tables.

COMMENT ON TABLE crossing_reports IS
  'Community-reported border crossing events. RETAINED FOR 3+ YEARS — this is the first-party dataset moat. No cleanup crons allowed. Archive to cold storage if hot table grows beyond Supabase plan limits, do NOT delete.';

COMMENT ON TABLE wait_time_readings IS
  'CBP wait-time readings captured every 15 min. RETAINED FOR 3+ YEARS — powers the historical fallback and all longitudinal pattern work. No cleanup crons allowed.';
