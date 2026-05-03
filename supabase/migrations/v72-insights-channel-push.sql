-- v72: Add push channel to Insights anomaly broadcast.
-- Bug fix 2026-05-02: anomaly-broadcast cron only handled email/sms/whatsapp.
-- Web push subscribers received zero alerts. Adds channel_push column
-- (default true so existing subscribers opt in) plus push_sent on the
-- fire log for observability.

ALTER TABLE insights_subscribers
  ADD COLUMN IF NOT EXISTS channel_push BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE insights_anomaly_fires
  ADD COLUMN IF NOT EXISTS push_sent BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS idx_insights_subscribers_active_anomaly;
CREATE INDEX IF NOT EXISTS idx_insights_subscribers_active_anomaly
  ON insights_subscribers (status)
  WHERE status = 'active'
    AND (channel_sms OR channel_email OR channel_whatsapp OR channel_push);
