-- v81-broker-of-record-and-ior-attestation.sql
-- Module 14 hardening per cruzar-m14-risk-register-20260503.md MS-2 + MS-5.
-- Adds the licensed-broker-of-record gate (UPL/§1641 defense) and IOR
-- attestation gate (False Claims Act defense) to refund_claims. Both must be
-- populated before a claim can transition validated → submitted_to_ace.

ALTER TABLE refund_claims
  ADD COLUMN IF NOT EXISTS broker_of_record_name TEXT,
  ADD COLUMN IF NOT EXISTS broker_of_record_license_number TEXT,
  ADD COLUMN IF NOT EXISTS broker_of_record_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ior_attested_signer_name TEXT,
  ADD COLUMN IF NOT EXISTS ior_attested_at TIMESTAMPTZ;

COMMENT ON COLUMN refund_claims.broker_of_record_license_number IS
  'CBP-issued customs broker license number for the broker of record. Required before submit_to_ace transition. UPL/19 USC 1641 defense.';

COMMENT ON COLUMN refund_claims.ior_attested_at IS
  'Timestamp when the importer of record attested they reviewed the CAPE CSV / Form 19 packet and authorize submission. False Claims Act defense.';

CREATE INDEX IF NOT EXISTS idx_refund_claims_broker_license
  ON refund_claims(broker_of_record_license_number)
  WHERE broker_of_record_license_number IS NOT NULL;
