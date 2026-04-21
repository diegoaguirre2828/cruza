-- v43 — camera-derived wait time readings.
--
-- Cruzar now blends a fourth signal into the wait-time pick: a Claude
-- vision model analyzes snapshots from the public bridge cameras we
-- already render, estimates the queue, and writes minutes here. The
-- /api/ports route reads the latest row per port and fuses it alongside
-- CBP, HERE Maps, and community reports.
--
-- Why: CBP sensors at some bridges (notably Brownsville B&M) chronically
-- under-report. HERE Maps traffic can't see stationary queues. Cameras
-- are the ground truth humans already see — making the AI read them
-- closes the gap between "app says 10 min" and "camera shows 45 min of
-- stopped cars."

CREATE TABLE IF NOT EXISTS camera_wait_readings (
  id uuid primary key default gen_random_uuid(),
  port_id text not null,
  captured_at timestamptz not null default now(),
  -- What the model saw
  cars_estimated int,
  minutes_estimated int,
  -- 'high' | 'medium' | 'low' — the model's own confidence call
  confidence text check (confidence in ('high', 'medium', 'low')),
  -- Source attribution
  camera_url text,
  model text default 'claude-haiku-4-5-20251001',
  -- Keep the raw JSON the model returned so we can audit / retrain prompts
  raw_response jsonb,
  -- Flag so downstream can skip malformed rows without deleting
  error_code text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_camera_wait_port_time
  ON camera_wait_readings (port_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_camera_wait_captured
  ON camera_wait_readings (captured_at DESC);

-- RLS: service role writes (cron), public reads so client-side fallback
-- paths can surface the value if /api/ports fails. Nothing sensitive in
-- here — just crowd counts.
ALTER TABLE camera_wait_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "camera_wait_readings_public_read" ON camera_wait_readings;
CREATE POLICY "camera_wait_readings_public_read"
  ON camera_wait_readings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "camera_wait_readings_service_write" ON camera_wait_readings;
CREATE POLICY "camera_wait_readings_service_write"
  ON camera_wait_readings FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
