-- Cross-portfolio calibration log.
-- Apply to every project's Supabase (or one shared Supabase project) that runs sims.
-- Table records every prediction made by an agent-sim / scenario-sim / outcome-sim
-- and the eventual observed outcome (or NULL if not yet known).
--
-- After 6+ months of accumulated data, this becomes the proprietary moat
-- (per `project_revenue_not_urgent_reframe_20260428.md`):
-- predicted-vs-observed across the portfolio sharpens every sim engine.
--
-- Apply via Cruzar's pattern:
--   npm run apply-migration -- ./calibration_log.sql
-- Or copy into each project's supabase/migrations/ directory with the next v<n>- prefix.

CREATE TABLE IF NOT EXISTS calibration_log (
  id BIGSERIAL PRIMARY KEY,

  -- Which project / sim engine produced this prediction.
  project TEXT NOT NULL CHECK (project IN ('cruzar', 'jetstream', 'fletcher', 'ledger', 'stack', 'laboral_mx', 'bravo')),
  sim_kind TEXT NOT NULL,  -- e.g. 'scenario-sim', 'outcome-sim', 'engagement-sim', 'counterfactual'
  sim_version TEXT NOT NULL,  -- e.g. 'v0', 'v0.4-rf', 'tribe-v2'

  -- The predicted value(s). Flexible JSONB so each sim type can store its own shape.
  predicted JSONB NOT NULL,

  -- The observed real-world outcome — NULL until the future arrives.
  observed JSONB,
  observed_at TIMESTAMPTZ,

  -- A scalar "loss" for fast querying (e.g. mean abs error, % off, binary 0/1 hit).
  -- Filled in by an analyzer job; nullable until observed.
  loss NUMERIC,

  -- Free-form context — what was the sim asked, what was the ground truth source.
  context JSONB,

  -- Tags for cohort analysis (e.g. ['port:230502','horizon:6h','goal:recovery']).
  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by project + sim_kind + recent.
CREATE INDEX IF NOT EXISTS idx_calibration_log_project_kind_created
  ON calibration_log (project, sim_kind, created_at DESC);

-- Tag search.
CREATE INDEX IF NOT EXISTS idx_calibration_log_tags
  ON calibration_log USING GIN (tags);

-- "Show me predictions still awaiting observation."
CREATE INDEX IF NOT EXISTS idx_calibration_log_pending
  ON calibration_log (created_at DESC)
  WHERE observed IS NULL;

-- ── RLS policy ──
-- Service role only writes. Authenticated users can read aggregate stats via a
-- VIEW (created separately). Raw table is service-role only.
ALTER TABLE calibration_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default; we deny everything else.
DROP POLICY IF EXISTS "calibration_log_no_user_read" ON calibration_log;
CREATE POLICY "calibration_log_no_user_read"
  ON calibration_log
  FOR SELECT
  TO authenticated
  USING (false);

-- Aggregate accuracy view (safe for authenticated readers).
-- Returns rolling 30-day MAE / hit-rate per (project, sim_kind, sim_version).
CREATE OR REPLACE VIEW calibration_accuracy_30d AS
SELECT
  project,
  sim_kind,
  sim_version,
  COUNT(*) FILTER (WHERE observed IS NOT NULL) AS resolved_count,
  COUNT(*) FILTER (WHERE observed IS NULL) AS pending_count,
  AVG(loss) FILTER (WHERE observed IS NOT NULL) AS mean_loss,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY loss) FILTER (WHERE observed IS NOT NULL) AS median_loss
FROM calibration_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY project, sim_kind, sim_version;

-- View readable by authenticated users (service role still exclusive on raw table).
GRANT SELECT ON calibration_accuracy_30d TO authenticated;

COMMENT ON TABLE calibration_log IS
  'Cross-portfolio prediction-vs-observed log. Service-role write, no user read on raw rows. See calibration_accuracy_30d view for aggregate stats.';
