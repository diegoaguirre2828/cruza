-- v70: Cruzar Insights B2B subscribers + anomaly fire log.
-- Applied 2026-05-01 to support the stress-reliever operator-panel rebuild.
-- Runs alongside existing `subscriptions` table (which tracks consumer Pro/Business);
-- this is the B2B Insights subscription layer with its own schema for watched ports,
-- briefing prefs, and per-channel recipients.

CREATE TABLE IF NOT EXISTS insights_subscribers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('free','starter','pro','fleet')) DEFAULT 'free',
  status TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','trialing')) DEFAULT 'trialing',

  watched_port_ids TEXT[] NOT NULL DEFAULT '{}',
  port_thresholds JSONB DEFAULT '{}',

  briefing_enabled BOOLEAN NOT NULL DEFAULT true,
  briefing_local_hour SMALLINT NOT NULL DEFAULT 5,
  briefing_tz TEXT NOT NULL DEFAULT 'America/Chicago',
  language TEXT NOT NULL CHECK (language IN ('en','es')) DEFAULT 'en',

  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_sms BOOLEAN NOT NULL DEFAULT false,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,

  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  recipient_phones TEXT[] NOT NULL DEFAULT '{}',

  anomaly_threshold_default NUMERIC NOT NULL DEFAULT 1.5,

  last_briefing_sent_at TIMESTAMPTZ,
  last_anomaly_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_subscribers_user ON insights_subscribers (user_id);
CREATE INDEX IF NOT EXISTS idx_insights_subscribers_active_briefing
  ON insights_subscribers (briefing_local_hour, status)
  WHERE status = 'active' AND briefing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_insights_subscribers_active_anomaly
  ON insights_subscribers (status)
  WHERE status = 'active' AND (channel_sms OR channel_email OR channel_whatsapp);

ALTER TABLE insights_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insights_subscribers_own_select" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_select" ON insights_subscribers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_subscribers_own_update" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_update" ON insights_subscribers
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_subscribers_own_insert" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_insert" ON insights_subscribers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS insights_anomaly_fires (
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL REFERENCES insights_subscribers(id) ON DELETE CASCADE,
  port_id TEXT NOT NULL,
  ratio NUMERIC NOT NULL,
  channels_fired TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anomaly_fires_dedupe
  ON insights_anomaly_fires (subscriber_id, port_id, fired_at DESC);

ALTER TABLE insights_anomaly_fires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anomaly_fires_no_user" ON insights_anomaly_fires;
CREATE POLICY "anomaly_fires_no_user" ON insights_anomaly_fires
  FOR SELECT TO authenticated USING (false);
