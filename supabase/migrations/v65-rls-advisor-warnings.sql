-- v65 — Supabase advisor warning sweep (16 warnings, 8 info, 2026-04-28).
-- Companion to v64 (which fixed the 3 errors).
--
-- Strategy: every API route uses getServiceClient() which bypasses RLS,
-- so locking anon/authenticated to deny does not break product behavior.
-- The "intentional public-read" tables (crossing_reports, exchange_rate_reports,
-- rewards_businesses, app_events / funnel_events / ad_events anon insert)
-- stay as-is — those warnings are noise and the data is by design public.

-- ────────────────────────────────────────────────────────────
-- 1. CRITICAL: audits — "service_role_audits" was created on TO public USING(true)
--    which meant anon could read every lead's email, phone, pain points,
--    business name, etc. The intent (per the policy name) was service-role only.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_audits" ON audits;
DROP POLICY IF EXISTS "audits_no_user_access" ON audits;
CREATE POLICY "audits_no_user_access"
  ON audits
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ────────────────────────────────────────────────────────────
-- 2. CRITICAL: advertisers — SELECT was open to public (qual=true), exposing
--    contact_email + contact_phone + business_name on every advertiser
--    application, including unapproved. Admin route uses service-role.
--    Keep the INSERT-from-anon path (self-service application form).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read advertisers" ON advertisers;
DROP POLICY IF EXISTS "advertisers_no_user_read" ON advertisers;
CREATE POLICY "advertisers_no_user_read"
  ON advertisers
  FOR SELECT
  TO anon, authenticated
  USING (false);

-- ────────────────────────────────────────────────────────────
-- 3. handle_new_user() is a SECURITY DEFINER trigger function. EXECUTE
--    granted to PUBLIC, anon, authenticated. The function only makes sense
--    when fired via the on_auth_user_created trigger; nobody outside
--    postgres / service_role should be able to call it directly.
-- ────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. Storage: port-photos
--    DELETE policy was qual=(bucket_id='port-photos') with no owner check —
--    any authenticated user could delete anyone's photo.
--    SELECT was the same shape — let anon list every file in the bucket.
--    The bucket's `public=true` flag still serves files via CDN URL
--    (which doesn't go through RLS), so getPublicUrl() keeps working
--    after we narrow the SELECT policy.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "port_photos_storage_owner_delete" ON storage.objects;
CREATE POLICY "port_photos_storage_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'port-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "port_photos_storage_public_read" ON storage.objects;
-- No SELECT policy = listing/download via API is denied.
-- CDN-served public URLs continue to work because the bucket has public=true.

-- ────────────────────────────────────────────────────────────
-- 5. RLS Enabled No Policy (8 tables) — RLS is on but no policies, which
--    already blocks anon/authenticated. Adding explicit deny policies so
--    the advisor's hygiene check passes and intent is documented.
--    Service role bypasses RLS unchanged.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'anomaly_camera_events',
    'business_clicks',
    'data_leads',
    'facebook_groups',
    'link_clicks',
    'mcp_key_request_log',
    'mcp_keys',
    'pattern_brain_sends'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_no_user_access', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t || '_no_user_access', t
    );
  END LOOP;
END
$$;
