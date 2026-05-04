-- v83-forecast-quality-view.sql
-- Per-port forecast quality scores derived from calibration_log.
-- The /dispatch and /insights forecast surfaces use this view to:
--   1. Hide forecasts for ports where MAE > 40 min (unreliable — would erode trust)
--   2. Pick the better-performing model (v0.4_RF vs cbp_climatology_fallback) per port
--   3. Display confidence bands from observed STDDEV
--
-- Per project_cruzar_thesis_the_connection_20260503 + the 2026-05-03 honest
-- prediction-quality audit. We'd rather show "live data only — forecast pending
-- calibration" than display garbage and erode broker trust.

CREATE OR REPLACE VIEW forecast_quality_30d AS
SELECT
  predicted->>'port_id' AS port_id,
  sim_version,
  sim_kind,
  COUNT(*) AS preds_total,
  COUNT(*) FILTER (WHERE observed IS NOT NULL) AS preds_scored,
  ROUND(AVG(loss) FILTER (WHERE observed IS NOT NULL)::numeric, 2) AS mae_min,
  ROUND(STDDEV(loss) FILTER (WHERE observed IS NOT NULL)::numeric, 2) AS std_min,
  CASE
    WHEN AVG(loss) FILTER (WHERE observed IS NOT NULL) IS NULL THEN 'unscored'
    WHEN AVG(loss) FILTER (WHERE observed IS NOT NULL) <= 20 THEN 'reliable'
    WHEN AVG(loss) FILTER (WHERE observed IS NOT NULL) <= 40 THEN 'borderline'
    ELSE 'unreliable'
  END AS quality_tier,
  MAX(created_at) AS last_prediction_at
FROM calibration_log
WHERE
  project = 'cruzar'
  AND sim_kind IN ('wait_forecast_6h', 'wait_forecast_3h', 'wait_forecast_1h')
  AND created_at >= NOW() - INTERVAL '30 days'
  AND predicted->>'port_id' IS NOT NULL
GROUP BY predicted->>'port_id', sim_version, sim_kind;

COMMENT ON VIEW forecast_quality_30d IS
  'Per-port × per-model forecast quality (last 30 days). Used by /dispatch + /insights to gate which forecasts get shown. quality_tier: reliable (MAE ≤ 20min) | borderline (≤ 40) | unreliable (> 40, hide UI) | unscored (not enough observations yet).';

-- Read access for service role + authenticated users
GRANT SELECT ON forecast_quality_30d TO service_role, authenticated, anon;
