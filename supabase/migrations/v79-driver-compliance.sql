-- v79: driver_compliance — Module 5 chassis log
-- One row per compliance check (USMCA Annex 31-A, IMSS, HOS, drug testing, drayage classification).

CREATE TABLE IF NOT EXISTS public.driver_compliance (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,                                -- nullable: check may run before Ticket signs
  shipment_ref TEXT,
  driver_ref TEXT,                               -- broker-supplied driver identifier (no PII required)
  check_type TEXT NOT NULL CHECK (check_type IN ('usmca_annex_31a','imss','hos','drug_testing','drayage_classification','manifest')),
  input_payload JSONB NOT NULL,
  output_payload JSONB NOT NULL,                 -- { compliant, reason, manifest_notes, ... }
  status TEXT NOT NULL CHECK (status IN ('compliant','non_compliant','flagged','inconclusive')),
  caller TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Calibration outcome (filled post-shipment by broker)
  outcome_confirmed BOOLEAN,
  outcome_recorded_at TIMESTAMPTZ,
  outcome_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_drv_check_type ON public.driver_compliance(check_type);
CREATE INDEX IF NOT EXISTS idx_drv_status ON public.driver_compliance(status);
CREATE INDEX IF NOT EXISTS idx_drv_created_at ON public.driver_compliance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drv_ticket ON public.driver_compliance(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drv_driver_ref ON public.driver_compliance(driver_ref) WHERE driver_ref IS NOT NULL;

ALTER TABLE public.driver_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access on driver_compliance"
  ON public.driver_compliance
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.driver_compliance IS 'Module 5 driver-side compliance check log. One row per check or manifest run. Status indicates broker action required: compliant=ok, flagged=review, non_compliant=block, inconclusive=needs more data. Outcome columns filled post-shipment for calibration.';
