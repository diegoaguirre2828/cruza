-- v45: FB-funnel quote lead capture.
-- Item 3 of Diego's "snake moves" bundle (2026-04-23).
--
-- quote_leads — minimal contact + trip info captured by /quote before the user
-- bounces out to an affiliate (Baja Bound / MexPro / Oscar Padilla). Keeps Cruzar
-- the retargetable party even when the conversion happens off-site.
--
-- Insert is anonymous / service-role only (the /api/quote/submit route uses
-- service-role). Read is admin-only.

CREATE TABLE IF NOT EXISTS quote_leads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text,
  phone text,
  first_name text,
  crossing_date date,
  trip_length text CHECK (trip_length IN ('day','weekend','week','month','year')),
  vehicle_type text CHECK (vehicle_type IN ('car','truck','suv','moto','rv','other')),
  destination_region text,
  preferred_provider text CHECK (preferred_provider IN ('baja-bound','mexpro','oscar-padilla','any')),
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_url text,
  user_agent text,
  ip_hash text,
  referred_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_leads_created_at ON quote_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_leads_source ON quote_leads (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_leads_email ON quote_leads (email) WHERE email IS NOT NULL;

ALTER TABLE quote_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages quote_leads"
  ON quote_leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
