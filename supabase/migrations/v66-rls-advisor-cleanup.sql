-- v66 — Final advisor cleanup (4 function search_paths + 7 INSERT WITH CHECK
-- tightening). Companion to v64 (errors) + v65 (warnings).
--
-- The 7 "Always True" INSERT policies are anonymous-write paths by design,
-- but `WITH CHECK (true)` lets clients submit unbounded payloads. Replace
-- each with minimal sanity checks that block obvious abuse (massive payloads,
-- mismatched user_id when authed) without changing the public-write intent.

-- ────────────────────────────────────────────────────────────
-- 1. Function search_path hygiene
-- ────────────────────────────────────────────────────────────
ALTER FUNCTION public.cruzar_random_handle SET search_path = '';
ALTER FUNCTION public.cruzar_fill_display_name SET search_path = '';
ALTER FUNCTION public.touch_tracked_loads_updated_at SET search_path = '';
ALTER FUNCTION public.touch_customs_declarations_updated_at SET search_path = '';

-- ────────────────────────────────────────────────────────────
-- 2. Telemetry tables — anon insert allowed but cap payload size
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can log ad events" ON ad_events;
CREATE POLICY "ad_events_insert"
  ON ad_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(coalesce(event_type, '')) <= 80);

DROP POLICY IF EXISTS "app_events_insert_anon" ON app_events;
CREATE POLICY "app_events_insert"
  ON app_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(event_name, '')) <= 120
    AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can insert funnel events" ON funnel_events;
CREATE POLICY "funnel_events_insert"
  ON funnel_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(event, '')) <= 120
    AND length(coalesce(session_id, '')) <= 64
  );

-- ────────────────────────────────────────────────────────────
-- 3. User-bound submission tables — owner check + size cap
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON crossing_reports;
CREATE POLICY "crossing_reports_insert"
  ON crossing_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (wait_minutes IS NULL OR (wait_minutes >= 0 AND wait_minutes <= 600))
    AND length(coalesce(description, '')) <= 1000
  );

DROP POLICY IF EXISTS "Anyone can submit exchange rate reports" ON exchange_rate_reports;
CREATE POLICY "exchange_rate_reports_insert"
  ON exchange_rate_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND length(coalesce(house_name, '')) <= 200
  );

-- ────────────────────────────────────────────────────────────
-- 4. Self-service application forms — minimal length caps
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can submit advertiser application" ON advertisers;
CREATE POLICY "advertisers_insert"
  ON advertisers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(business_name, '')) BETWEEN 1 AND 200
    AND length(coalesce(contact_email, '')) BETWEEN 5 AND 200
    AND contact_email LIKE '%@%'
    AND length(coalesce(description, '')) <= 2000
  );

DROP POLICY IF EXISTS "Anyone can submit a business listing" ON rewards_businesses;
CREATE POLICY "rewards_businesses_insert"
  ON rewards_businesses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(name, '')) BETWEEN 1 AND 200
    AND length(coalesce(description, '')) <= 1000
    AND length(coalesce(notes_es, '')) <= 1000
  );
