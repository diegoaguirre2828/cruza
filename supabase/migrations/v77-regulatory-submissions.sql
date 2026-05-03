-- v77: regulatory_submissions — Module 3 composition log
-- One row per composed agency submission (FDA Prior Notice, USDA APHIS, ISF 10+2, CBP 7501).

CREATE TABLE IF NOT EXISTS public.regulatory_submissions (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,                                -- nullable: composer may run before Ticket signs
  agency TEXT NOT NULL CHECK (agency IN ('FDA','USDA','CBP_ISF','CBP_7501')),
  shipment_ref TEXT,
  composed_payload JSONB NOT NULL,               -- the structured submission body
  composed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pre_arrival_deadline TIMESTAMPTZ,              -- e.g. 2h before arrival for FDA
  filer_status TEXT DEFAULT 'pending'
    CHECK (filer_status IN ('pending','submitted_externally','accepted','rejected','superseded')),
  external_ref TEXT,                             -- agency confirmation # when broker reports back
  external_ref_recorded_at TIMESTAMPTZ,
  caller TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reg_subs_agency ON public.regulatory_submissions(agency);
CREATE INDEX IF NOT EXISTS idx_reg_subs_composed_at ON public.regulatory_submissions(composed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reg_subs_ticket_id ON public.regulatory_submissions(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reg_subs_status ON public.regulatory_submissions(filer_status);

ALTER TABLE public.regulatory_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access on regulatory_submissions"
  ON public.regulatory_submissions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.regulatory_submissions IS 'Module 3 composed agency submissions. Status starts pending; broker reports back filer status + external_ref after they file via their own ACE/PNSI/eFile accounts.';
