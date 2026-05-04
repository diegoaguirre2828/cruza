-- v87 — Anomaly broadcaster dedupe column
--
-- Adds last_anomaly_fire_at to alert_preferences so the new
-- /api/cron/crossing-anomaly-broadcast cron (Phase 4 of the Cruzar
-- Crossing substrate) doesn't re-page the same alert during a
-- continuous incident window. The cron checks this column with a
-- 2-hour dedupe before firing.
--
-- Distinct from last_triggered_at (used by the threshold-based wait-
-- drop send-alerts cron) — this column is purely for the bridge-
-- incident anomaly path.

alter table public.alert_preferences
  add column if not exists last_anomaly_fire_at timestamptz;

create index if not exists alert_preferences_last_anomaly_idx
  on public.alert_preferences (last_anomaly_fire_at)
  where last_anomaly_fire_at is not null;
