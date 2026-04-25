-- v51 — Auto-crossing default flips from OFF to ON (2026-04-25)
--
-- Phase 1 originally shipped opt-in default OFF (v48). On
-- reflection: the per-crossing consent is the explicit "I'm in
-- line now" button tap, not the profile-level toggle. Defaulting
-- the toggle OFF means new users never see the feature and never
-- contribute data — which kills the flywheel before it spins.
--
-- New default: ON. The /account toggle becomes an opt-OUT for
-- users who don't want the feature visible at all. Existing rows
-- (all of which were created before this flip) get flipped to TRUE
-- because none of them represent an explicit user choice — they
-- were just the column default. From this migration forward, FALSE
-- means "user explicitly disabled it in /account".

BEGIN;

-- Flip every existing row from the v48 default of FALSE to TRUE.
-- This is safe because no user has explicitly opted out yet (the
-- feature shipped today and has no organic uptake).
UPDATE profiles
   SET auto_geofence_opt_in = true,
       auto_geofence_opt_in_at = COALESCE(auto_geofence_opt_in_at, now())
 WHERE auto_geofence_opt_in = false;

-- Change the column default so future profiles start as ON.
ALTER TABLE profiles
  ALTER COLUMN auto_geofence_opt_in SET DEFAULT true;

COMMIT;
