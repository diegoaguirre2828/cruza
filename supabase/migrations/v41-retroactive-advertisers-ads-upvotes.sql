-- v41 — retroactive capture of tables created ad-hoc in Supabase SQL Editor
--
-- Why: sensei audit 2026-04-18 found 4 tables referenced in code but with no
-- CREATE TABLE anywhere in the repo. Prod probe confirmed they exist — they
-- were created manually at some point and never written into git. This
-- migration is the git record.
--
-- Schemas are reverse-engineered from prod (information_schema + pg_indexes
-- + pg_policies) on 2026-04-18 via the Supabase Management API.
--
-- Fully idempotent — CREATE TABLE IF NOT EXISTS + DROP/CREATE POLICY. Safe to
-- re-apply. Applying to a fresh environment reproduces prod 1:1 for these
-- tables.
--
-- Referenced by:
--   advertisers    → app/api/advertise/route.ts, app/api/admin/advertisers/route.ts
--   ads            → app/api/ads/route.ts
--   ad_events      → app/api/ads/route.ts (impression/click log)
--   report_upvotes → app/api/reports/upvote/route.ts

-- ─── advertisers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advertisers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name  VARCHAR NOT NULL,
  contact_email  VARCHAR NOT NULL,
  contact_phone  VARCHAR,
  website        VARCHAR,
  description    TEXT,
  status         VARCHAR DEFAULT 'pending',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE advertisers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit advertiser application" ON advertisers;
CREATE POLICY "Anyone can submit advertiser application" ON advertisers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read advertisers" ON advertisers;
CREATE POLICY "Authenticated users can read advertisers" ON advertisers
  FOR SELECT USING (true);

-- ─── ads ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id          UUID,
  title                  VARCHAR NOT NULL,
  description            VARCHAR,
  cta_text               VARCHAR DEFAULT 'Learn More',
  cta_url                VARCHAR,
  image_url              VARCHAR,
  ad_type                VARCHAR DEFAULT 'sponsored_card',
  target_regions         VARCHAR[],
  target_ports           VARCHAR[],
  min_wait_trigger       INTEGER,
  active                 BOOLEAN DEFAULT TRUE,
  starts_at              TIMESTAMPTZ DEFAULT NOW(),
  ends_at                TIMESTAMPTZ,
  monthly_rate           INTEGER,
  stripe_subscription_id VARCHAR,
  impressions            INTEGER DEFAULT 0,
  clicks                 INTEGER DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active ads" ON ads;
CREATE POLICY "Anyone can read active ads" ON ads
  FOR SELECT USING (active = true);

-- ─── ad_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id       UUID,
  event_type  VARCHAR NOT NULL,
  port_id     VARCHAR,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log ad events" ON ad_events;
CREATE POLICY "Anyone can log ad events" ON ad_events
  FOR INSERT WITH CHECK (true);

-- ─── report_upvotes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_upvotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (report_id, user_id)
);

ALTER TABLE report_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read upvotes" ON report_upvotes;
CREATE POLICY "Anyone can read upvotes" ON report_upvotes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own upvotes" ON report_upvotes;
CREATE POLICY "Users manage own upvotes" ON report_upvotes
  FOR ALL USING (auth.uid() = user_id);
