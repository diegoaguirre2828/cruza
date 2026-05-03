-- v44: Port wait-time spike detection + bilingual FB post draft review.
-- Item 1 of Diego's "snake moves" bundle (2026-04-23).
--
-- port_spikes — one row per detected anomaly. De-duped by (port_id, detected_at bucket).
-- post_drafts — LLM-generated FB-ready copy awaiting manual admin review before posting.
--
-- Admin-only write via service role. Service-role-read for cron. No public access.

CREATE TABLE IF NOT EXISTS port_spikes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  port_id text NOT NULL,
  port_name text,
  region text,
  lane text NOT NULL CHECK (lane IN ('vehicle','sentri','pedestrian','commercial')),
  current_wait integer NOT NULL,
  baseline_wait integer NOT NULL,
  delta_minutes integer NOT NULL,
  delta_pct numeric(10,2) NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning','high','critical')),
  reading_recorded_at timestamptz NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  drafted boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  note text
);

CREATE INDEX IF NOT EXISTS idx_port_spikes_detected_at ON port_spikes (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_port_spikes_port_detected ON port_spikes (port_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_port_spikes_undrafted ON port_spikes (drafted, dismissed) WHERE drafted = false AND dismissed = false;

ALTER TABLE port_spikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages port_spikes"
  ON port_spikes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS post_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_kind text NOT NULL CHECK (source_kind IN ('spike','manual','thread-reply')),
  source_ref_id bigint,
  port_id text,
  region text,
  caption_es text NOT NULL,
  caption_en text,
  hashtags text,
  landing_url text,
  model text,
  prompt_version text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','dismissed')),
  posted_at timestamptz,
  posted_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_drafts_status_created ON post_drafts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_drafts_source ON post_drafts (source_kind, source_ref_id);

ALTER TABLE post_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages post_drafts"
  ON post_drafts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- FK: once a draft is created from a spike, tag the spike as drafted.
ALTER TABLE port_spikes
  ADD COLUMN IF NOT EXISTS draft_id bigint REFERENCES post_drafts(id) ON DELETE SET NULL;
