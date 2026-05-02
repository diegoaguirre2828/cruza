-- v71: Model A/B log table.
-- Per docs/superpowers/specs/cruzar-nemotron-experiment-spec.md
-- (authored from brain terminal 2026-05-01).
--
-- Single-call-site experiment on the intel-brief cron — measures
-- whether NVIDIA Nemotron 3 Super (free via OpenRouter) can replace
-- Claude Sonnet at acceptable quality for the daily border brief.
-- Logs every call so we can compare latency / token / output_chars
-- after a 7-day soak.

CREATE TABLE IF NOT EXISTS model_ab_log (
  id BIGSERIAL PRIMARY KEY,
  call_site TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INT,
  tokens_in INT,
  tokens_out INT,
  output_chars INT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_ab_log_callsite_ts
  ON model_ab_log (call_site, ts DESC);

ALTER TABLE model_ab_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_ab_log_no_user_read" ON model_ab_log;
CREATE POLICY "model_ab_log_no_user_read" ON model_ab_log
  FOR SELECT TO authenticated USING (false);
