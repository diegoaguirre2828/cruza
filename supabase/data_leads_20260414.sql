-- Data lead capture from the /data public landing page.
-- Anyone Googling "border crossing dataset" or "Mexico border freight
-- data" lands here, sees the pitch, fills the form, we get their email
-- + company + use case. Follow-up is manual at first.

CREATE TABLE IF NOT EXISTS data_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  use_case TEXT,
  estimated_volume TEXT,
  source_utm TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_leads_created
  ON data_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_leads_uncontacted
  ON data_leads(created_at DESC)
  WHERE contacted_at IS NULL;

COMMENT ON TABLE data_leads IS
  'B2B lead capture from /data landing page. No PII retention concerns — emails are explicitly provided. Admin panel reads from this table to triage follow-ups.';

-- Allow the service role to insert leads via the public API route.
-- No public SELECT policy — only the admin dashboard reads this.
ALTER TABLE data_leads ENABLE ROW LEVEL SECURITY;
