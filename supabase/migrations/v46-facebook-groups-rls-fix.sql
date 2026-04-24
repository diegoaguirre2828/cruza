-- v46: Enable RLS on facebook_groups (Supabase Advisor CRITICAL fix, 2026-04-23)
--
-- Background: v39 migration declared `ALTER TABLE facebook_groups ENABLE ROW LEVEL SECURITY`
-- but the table was originally created via the Supabase SQL editor before that migration
-- existed, and the v39 file may never have been applied to prod. Supabase Advisor flagged
-- public.facebook_groups as RLS-disabled on 2026-04-23 immediately after the legacy JWT keys
-- were disabled.
--
-- Both routes that touch this table use the service-role client (`getServiceClient()`),
-- which bypasses RLS, so enabling RLS without policies is safe — no anon/publishable code
-- paths read or write this table:
--   app/api/promoter/groups/route.ts        — GET + POST via service role
--   app/api/promoter/groups/[id]/route.ts   — DELETE via service role
--
-- Fully idempotent.

ALTER TABLE facebook_groups ENABLE ROW LEVEL SECURITY;
