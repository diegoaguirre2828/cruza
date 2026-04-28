-- v62: tracked_loads refresh infrastructure for the operator-alerts b+c fix.
--
-- Adds:
--   prior_predicted_eta_minutes — frozen copy of the previous compute so the
--     dispatch-alerts cron can fire eta_slip_minutes rules against a stable
--     prior. Stamped before each refresh.
--
--   drive_cache — per-port HERE Routing drive-time cache. Layer (c) full
--     re-routes on loads with appointment_at < now+6hr would otherwise burn
--     through the HERE 250k/mo free tier; with this cache the first compute
--     pays full HERE cost and subsequent re-routes (within TTL) hit cache.
--     Schema: { "<port_id>": { "to_bridge_min": int, "to_dock_min": int,
--                              "cached_at": "<iso ts>" }, ... }
--     TTL is enforced in lib/loadEta.ts (24 hours).
--
-- Idempotent. Safe to re-run.

BEGIN;

ALTER TABLE tracked_loads
  ADD COLUMN IF NOT EXISTS prior_predicted_eta_minutes INT;

ALTER TABLE tracked_loads
  ADD COLUMN IF NOT EXISTS drive_cache JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
