-- v42 — Business tier rebuild (2026-04-20 EVE)
--
-- Adds schema foundation for the full Samsara/Motive-parity Business
-- tier rebuild: public tracking links, southbound community reports,
-- third-party fleet integrations (Samsara + Motive OAuth), continuous
-- driver GPS, trip replay timeline. All idempotent via IF NOT EXISTS.
--
-- Paired with pricing change ($49.99 → $19.99) in Stripe product config.

-- ─────────────────────────────────────────────────────────────────
-- 1. shipment_tokens — short codes dispatchers share with consignees
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_tokens (
  token        TEXT PRIMARY KEY,
  shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_shipment_tokens_shipment ON shipment_tokens(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tokens_expires  ON shipment_tokens(expires_at);

ALTER TABLE shipment_tokens ENABLE ROW LEVEL SECURITY;

-- Owner can read/write their own tokens
DROP POLICY IF EXISTS shipment_tokens_owner_all ON shipment_tokens;
CREATE POLICY shipment_tokens_owner_all ON shipment_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public lookup path goes through service role (no anon SELECT policy).

-- ─────────────────────────────────────────────────────────────────
-- 2. crossing_reports — direction column (southbound unlock)
-- ─────────────────────────────────────────────────────────────────
-- CBP public API is northbound-only. Community reports fill the
-- southbound gap — half the market nobody else has.
ALTER TABLE crossing_reports
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'northbound'
    CHECK (direction IN ('northbound', 'southbound'));
CREATE INDEX IF NOT EXISTS idx_crossing_reports_direction_port
  ON crossing_reports(direction, port_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 3. fleet_integrations — Samsara + Motive OAuth storage
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fleet_integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL CHECK (provider IN ('samsara', 'motive')),
  org_id         TEXT,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT,
  token_type     TEXT DEFAULT 'Bearer',
  expires_at     TIMESTAMPTZ,
  scope          TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_fleet_integrations_user
  ON fleet_integrations(user_id, provider);

ALTER TABLE fleet_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_integrations_owner_all ON fleet_integrations;
CREATE POLICY fleet_integrations_owner_all ON fleet_integrations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- 4. drivers — continuous GPS columns
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS current_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS current_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_shift BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shift_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_port_id TEXT;

-- Drivers table uses `owner_id` (fleet owner) not `user_id` — drivers
-- themselves don't have accounts; tokens auth them. Indexing on owner.
CREATE INDEX IF NOT EXISTS idx_drivers_on_shift
  ON drivers(owner_id, on_shift, location_updated_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 5. shipment_events — timeline for trip replay
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id    UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL CHECK (event_type IN (
    'scheduled','driver_dispatched','en_route','at_bridge',
    'in_line','crossing','cleared','delivered','delayed','canceled','gps_ping'
  )),
  lat            NUMERIC(9,6),
  lng            NUMERIC(9,6),
  port_id        TEXT,
  wait_snapshot  INTEGER,
  notes          TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment
  ON shipment_events(shipment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_events_user_time
  ON shipment_events(user_id, occurred_at DESC);

ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipment_events_owner_all ON shipment_events;
CREATE POLICY shipment_events_owner_all ON shipment_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public track page reads through service role, not via anon policy.

-- ─────────────────────────────────────────────────────────────────
-- 6. Business tier rename — optional metadata for analytics
-- ─────────────────────────────────────────────────────────────────
-- No schema change for the $49.99 → $19.99 price rename; that happens
-- in Stripe product config + /pricing copy. Keeping this comment as a
-- breadcrumb for future audit: if tier values ever diverge from
-- ('guest','free','pro','business'), update the checkBusinessTier()
-- helpers in app/api/business/*/route.ts.
