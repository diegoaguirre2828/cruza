-- v80-refund-claims.sql — Module 14 IEEPA Refund Composer

CREATE TABLE IF NOT EXISTS refund_claims (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  ior_name TEXT NOT NULL,
  ior_id_number TEXT NOT NULL,
  filer_code TEXT,
  total_entries INT NOT NULL DEFAULT 0,
  total_principal_owed_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_interest_owed_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  cape_eligible_count INT NOT NULL DEFAULT 0,
  protest_required_count INT NOT NULL DEFAULT 0,
  past_protest_window_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  cape_csv_url TEXT,
  form19_packet_url TEXT,
  cape_claim_number TEXT,
  refund_received_at TIMESTAMPTZ,
  refund_received_amount_usd NUMERIC(14,2),
  stripe_charge_id TEXT,
  cruzar_fee_usd NUMERIC(14,2),
  language TEXT NOT NULL DEFAULT 'en',
  theme_token JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_claims_user_id ON refund_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_claims_status ON refund_claims(status);

CREATE TABLE IF NOT EXISTS refund_claim_entries (
  id BIGSERIAL PRIMARY KEY,
  claim_id BIGINT NOT NULL REFERENCES refund_claims(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  liquidation_date DATE,
  liquidation_status TEXT,
  country_of_origin TEXT,
  htsus_chapter_99_code TEXT,
  applicable_eo TEXT,
  ieepa_principal_paid_usd NUMERIC(12,2) NOT NULL,
  section_232_paid_usd NUMERIC(12,2) DEFAULT 0,
  section_301_paid_usd NUMERIC(12,2) DEFAULT 0,
  refund_amount_usd NUMERIC(12,2) NOT NULL,
  interest_accrued_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  cliff_status TEXT NOT NULL,
  validation_errors JSONB,
  cbp_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_claim_entries_claim_id ON refund_claim_entries(claim_id);

CREATE TABLE IF NOT EXISTS ach_onboarding_status (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  ace_portal_account_status TEXT NOT NULL DEFAULT 'not_started',
  ace_portal_account_started_at TIMESTAMPTZ,
  ace_portal_account_active_at TIMESTAMPTZ,
  ach_enrollment_status TEXT NOT NULL DEFAULT 'not_started',
  ach_enrollment_complete_at TIMESTAMPTZ,
  bank_routing_last4 TEXT,
  bank_account_last4 TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE refund_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_claim_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ach_onboarding_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY refund_claims_own_select ON refund_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY refund_claims_own_insert ON refund_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY refund_claims_own_update ON refund_claims FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY refund_claim_entries_own_select ON refund_claim_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM refund_claims WHERE id = refund_claim_entries.claim_id AND user_id = auth.uid())
);
CREATE POLICY refund_claim_entries_own_insert ON refund_claim_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM refund_claims WHERE id = refund_claim_entries.claim_id AND user_id = auth.uid())
);

CREATE POLICY ach_onboarding_own_all ON ach_onboarding_status FOR ALL USING (auth.uid() = user_id);
