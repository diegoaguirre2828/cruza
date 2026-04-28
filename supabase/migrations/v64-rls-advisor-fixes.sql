-- v64 — Supabase advisor fixes (3 critical findings, 2026-04-28).
--
-- 1. intel_subscribers: emails, telegram_chat_id, slack_webhook_url, stripe_subscription_id
--    were anon-readable. All API access uses service-role; lock anon/authenticated out.
-- 2. sales_inquiries: lead emails + company + use case were anon-readable. Same fix.
-- 3. calibration_accuracy_30d: SECURITY DEFINER view bypassed calibration_log RLS.
--    Recreate with security_invoker; only service-role (admin route) reads it.

ALTER TABLE intel_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intel_subscribers_no_user_access" ON intel_subscribers;
CREATE POLICY "intel_subscribers_no_user_access"
  ON intel_subscribers
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE sales_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_inquiries_no_user_access" ON sales_inquiries;
CREATE POLICY "sales_inquiries_no_user_access"
  ON sales_inquiries
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP VIEW IF EXISTS calibration_accuracy_30d;
CREATE VIEW calibration_accuracy_30d
  WITH (security_invoker = true) AS
SELECT
  project,
  sim_kind,
  sim_version,
  COUNT(*) FILTER (WHERE observed IS NOT NULL) AS resolved_count,
  COUNT(*) FILTER (WHERE observed IS NULL) AS pending_count,
  AVG(loss) FILTER (WHERE observed IS NOT NULL) AS mean_loss,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY loss) FILTER (WHERE observed IS NOT NULL) AS median_loss
FROM calibration_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY project, sim_kind, sim_version;

REVOKE ALL ON calibration_accuracy_30d FROM anon, authenticated;
GRANT SELECT ON calibration_accuracy_30d TO service_role;
