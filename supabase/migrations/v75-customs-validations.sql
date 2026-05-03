-- v75: customs_validations — Module 2 chassis log
-- One row per chassis call (HS classify, origin validate, RVC calculate).
-- Feeds /insights/accuracy customer-facing scoreboard.

CREATE TABLE IF NOT EXISTS public.customs_validations (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,                                -- nullable: validation may run before Ticket signs
  call_type TEXT NOT NULL CHECK (call_type IN ('hs_classify','origin_validate','rvc_calculate')),
  shipment_ref TEXT,
  input_payload JSONB NOT NULL,
  output_payload JSONB NOT NULL,
  confidence NUMERIC(5,4),                       -- 0.0000 - 1.0000
  duration_ms INTEGER,
  caller TEXT,                                   -- e.g. 'api/customs/classify', 'mcp/cruzar_generate_customs'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Calibration outcome (filled post-clearance)
  outcome_payload JSONB,
  outcome_recorded_at TIMESTAMPTZ,
  outcome_match BOOLEAN,                         -- did our prediction match broker-confirmed reality?
  outcome_delta JSONB                            -- structured diff
);

CREATE INDEX IF NOT EXISTS idx_customs_validations_call_type
  ON public.customs_validations(call_type);
CREATE INDEX IF NOT EXISTS idx_customs_validations_created_at
  ON public.customs_validations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customs_validations_ticket_id
  ON public.customs_validations(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customs_validations_outcome
  ON public.customs_validations(outcome_recorded_at DESC) WHERE outcome_recorded_at IS NOT NULL;

ALTER TABLE public.customs_validations ENABLE ROW LEVEL SECURITY;

-- Service role only (no public read; use accuracy-summary API for client access)
CREATE POLICY "service role full access on customs_validations"
  ON public.customs_validations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.customs_validations IS 'Module 2 chassis call log. Pairs with calibration_log (v63) for cross-portfolio accuracy thesis. Outcome columns filled post-clearance by broker.';
