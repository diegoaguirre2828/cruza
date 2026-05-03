-- v74: kill the circles feature completely.
-- Diego 2026-05-02: "kill the circle feature completely."
--
-- All 3 circle tables verified empty (0 rows) before drop.
-- Dropping cascade also takes family_eta_pings (depends on circle_id),
-- the wallet_documents.shared_with_circle_id column + policy, and the
-- emergency_events.notified_circle_ids column + policy.

DROP POLICY IF EXISTS "wallet_documents_circle_read" ON public.wallet_documents;
ALTER TABLE IF EXISTS public.wallet_documents DROP COLUMN IF EXISTS shared_with_circle_id;

DROP POLICY IF EXISTS "emergency_events_circle_read" ON public.emergency_events;
ALTER TABLE IF EXISTS public.emergency_events DROP COLUMN IF EXISTS notified_circle_ids;

DROP TABLE IF EXISTS public.family_eta_pings CASCADE;
DROP TABLE IF EXISTS public.circle_invites CASCADE;
DROP TABLE IF EXISTS public.circle_members CASCADE;
DROP TABLE IF EXISTS public.circles CASCADE;
