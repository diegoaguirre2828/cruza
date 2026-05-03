-- v82-eudamed-actor-and-udi.sql
-- EU MDR / EUDAMED actor + UDI/Device data persistence for Reynosa medtech wedge.
-- Per cruzar-m14-risk-register-20260503 + b2b research synthesis 2026-05-03.
-- Cruzar substrate captures the data; OEM compliance team submits to EUDAMED.

CREATE TABLE IF NOT EXISTS eudamed_actor_registrations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'manufacturer','authorized_representative','importer','distributor',
    'system_procedure_pack_producer','sterilizer'
  )),
  srn TEXT,
  registration_country_iso CHAR(2) NOT NULL,
  vat_or_tax_id TEXT,
  address_street TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_postal_code TEXT NOT NULL,
  address_country_iso CHAR(2) NOT NULL,
  contact_email TEXT NOT NULL,
  authorized_rep_srn TEXT,
  is_submission_ready BOOLEAN NOT NULL DEFAULT false,
  validation_warnings JSONB,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','es')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eudamed_actor_user ON eudamed_actor_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_eudamed_actor_srn ON eudamed_actor_registrations(srn) WHERE srn IS NOT NULL;

CREATE TABLE IF NOT EXISTS eudamed_udi_records (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES eudamed_actor_registrations(id) ON DELETE SET NULL,

  -- UDI Device Identifier (static)
  issuing_agency TEXT NOT NULL CHECK (issuing_agency IN ('GS1','HIBCC','ICCBBA','IFA')),
  udi_di TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  model_or_reference_number TEXT NOT NULL,

  -- UDI Production Identifier (per shipment / lot)
  lot_number TEXT,
  serial_number TEXT,
  manufacturing_date DATE,
  expiry_date DATE,
  software_version TEXT,

  -- Classification + EUDAMED metadata
  gmdn_code TEXT NOT NULL,
  gmdn_term TEXT NOT NULL,
  risk_class TEXT NOT NULL CHECK (risk_class IN (
    'I','I_sterile','I_measuring','I_reusable','IIa','IIb','III','AIMD',
    'IVD_A','IVD_B','IVD_C','IVD_D'
  )),
  is_sterile BOOLEAN NOT NULL DEFAULT false,
  has_measuring_function BOOLEAN NOT NULL DEFAULT false,
  is_active_implantable BOOLEAN NOT NULL DEFAULT false,
  notified_body_id TEXT,
  ce_marking_status TEXT NOT NULL CHECK (ce_marking_status IN (
    'declared','in_transition_mdd_to_mdr','expired','unmarked'
  )),
  manufacturer_catalogue_number TEXT,

  -- Composition record
  is_eudamed_ready BOOLEAN NOT NULL DEFAULT false,
  validation_missing_fields JSONB,
  composed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registry_version TEXT NOT NULL,

  -- Cross-link to underlying customs event (Cruzar Ticket) when available
  ticket_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eudamed_udi_user ON eudamed_udi_records(user_id);
CREATE INDEX IF NOT EXISTS idx_eudamed_udi_actor ON eudamed_udi_records(actor_id);
CREATE INDEX IF NOT EXISTS idx_eudamed_udi_di ON eudamed_udi_records(udi_di);
CREATE INDEX IF NOT EXISTS idx_eudamed_udi_ticket ON eudamed_udi_records(ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE eudamed_actor_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE eudamed_udi_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY eudamed_actor_own_select ON eudamed_actor_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY eudamed_actor_own_insert ON eudamed_actor_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY eudamed_actor_own_update ON eudamed_actor_registrations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY eudamed_udi_own_select ON eudamed_udi_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY eudamed_udi_own_insert ON eudamed_udi_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY eudamed_udi_own_update ON eudamed_udi_records FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE eudamed_actor_registrations IS
  'EU MDR/IVDR EUDAMED actor data captured for Reynosa medtech maquilas + EU manufacturers. Cruzar prepares; OEM compliance team submits to EUDAMED.';
COMMENT ON TABLE eudamed_udi_records IS
  'UDI-DI/PI per device, including risk class, NB ID, CE marking, GMDN. Captured at cross-border events. Exported as CSV for EUDAMED UDI/Device module upload.';
