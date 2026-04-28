-- v64 — Co-Pilot trip mode + iOS Live Activity opt-in
--
-- Pillar 2 Co-Pilot v0 web ship. The Live Activity opt-in is forward-looking
-- (the actual Swift widget extension lands in a future iOS build); web stores
-- the preference now so the iOS app can read + honor it on first launch after
-- approval.
--
-- copilot_live_activity_opt_in: user wants the Live Activity lock-screen
--   widget when the iOS app supports it. Default false.
--
-- copilot_active_trip_id: pointer to the family_eta_pings row representing
--   the currently-active Co-Pilot trip (if any). NULL = no active trip.
--   Used to dedupe the "I crossed" auto-fire so a single trip produces one
--   ETA ping and one cross ping, not duplicates from geofence flapping.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS copilot_live_activity_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS copilot_active_trip_id uuid REFERENCES public.family_eta_pings(id) ON DELETE SET NULL;

COMMIT;
