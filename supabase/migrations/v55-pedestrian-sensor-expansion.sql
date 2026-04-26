-- v55 — pedestrian sensor expansion
--
-- Diego asked 2026-04-26: walking data is sparse from CBP (often null,
-- often hours stale, often a guess). Three accuracy paths get wired:
--   1. Pedestrian-specific community reports — the API already accepts
--      laneType='pedestrian' but the public form lumps everything into
--      vehicle. Surfaced by a top-level toggle in ReportForm + a derive
--      rule in /api/reports so vehicleType='pedestrian' implies the
--      same lane_type.
--   2. Camera-vision pedestrian count — extend the existing Claude
--      Haiku camera prompt to also count people in line, store it
--      alongside the cars count on the same row (one image, two
--      outputs, zero extra fetch cost).
--   3. BTS baseline overlay — public-domain monthly pedestrian counts
--      per port from the Bureau of Transportation Statistics, used to
--      show "normalmente cruzan ~140 peatones/h por aquí" as context
--      band in the hero card.
--
-- The /api/ports route reads all three and builds a separate
-- pedestrian wait number with its own source attribution.

-- ─── 1. Pedestrian fields on camera_wait_readings ───────────────────

ALTER TABLE camera_wait_readings
  ADD COLUMN IF NOT EXISTS pedestrians_estimated int,
  ADD COLUMN IF NOT EXISTS pedestrian_minutes_estimated int,
  ADD COLUMN IF NOT EXISTS pedestrian_confidence text
    CHECK (pedestrian_confidence IS NULL OR pedestrian_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS pedestrian_lanes_visible int;

COMMENT ON COLUMN camera_wait_readings.pedestrians_estimated IS
  'Total people visible in the pedestrian queue. NULL when no pedestrian queue is in frame.';
COMMENT ON COLUMN camera_wait_readings.pedestrian_minutes_estimated IS
  'Estimated wait at the back of the pedestrian line, derived from queue depth, visible lane count, and observed motion. NULL when no estimate possible.';
COMMENT ON COLUMN camera_wait_readings.pedestrian_confidence IS
  'Model self-rated confidence in the pedestrian estimate. Treated same as vehicle: high/medium fuse, low ignored.';
COMMENT ON COLUMN camera_wait_readings.pedestrian_lanes_visible IS
  'How many pedestrian inspection lanes are visible. Used in flow-rate math: people / (throughput * lanes).';

-- ─── 2. BTS pedestrian baseline (monthly, per port) ──────────────────

CREATE TABLE IF NOT EXISTS bts_pedestrian_baseline (
  port_id text NOT NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  pedestrians_count int NOT NULL CHECK (pedestrians_count >= 0),
  source text NOT NULL DEFAULT 'BTS Border Crossing Entry Data',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (port_id, year, month)
);

COMMENT ON TABLE bts_pedestrian_baseline IS
  'Monthly pedestrian crossing counts per port from the Bureau of Transportation Statistics. Public domain. Used as the "what is normal" band on hero cards and as the divisor in flow-rate math.';

CREATE INDEX IF NOT EXISTS idx_bts_ped_baseline_port_recent
  ON bts_pedestrian_baseline (port_id, year DESC, month DESC);

-- RLS — public read (it's public data anyway), service-only write
ALTER TABLE bts_pedestrian_baseline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bts_ped_baseline_public_read" ON bts_pedestrian_baseline;
CREATE POLICY "bts_ped_baseline_public_read"
  ON bts_pedestrian_baseline FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "bts_ped_baseline_service_write" ON bts_pedestrian_baseline;
CREATE POLICY "bts_ped_baseline_service_write"
  ON bts_pedestrian_baseline FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "bts_ped_baseline_service_update" ON bts_pedestrian_baseline;
CREATE POLICY "bts_ped_baseline_service_update"
  ON bts_pedestrian_baseline FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
