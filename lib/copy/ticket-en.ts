// lib/copy/ticket-en.ts
export const TICKET_EN = {
  // Chrome
  title: 'Cruzar Ticket',
  subtitle: 'One signed record. Every cross-border module. Verifiable.',
  issued_at: 'Issued',
  ticket_id: 'Ticket ID',
  signature_valid: 'Signature valid',
  signature_invalid: 'Verification failed',
  superseded_by: 'Superseded by',
  modules_present: 'Modules composed',
  spec_link: 'Cruzar Ticket v1 spec',
  verify_at: 'Verify this signature at',

  // Cross-references — the substrate composing
  cross_refs_section: 'Cross-references — entries × modules',
  cross_refs_intro: 'Each entry shows every module that fired on it. Multi-module entries are the substrate composing.',
  cross_ref_entry: 'Entry',
  cross_ref_fired_in: 'Fired in',
  cross_ref_at_risk: 'At risk',

  // Shipment
  shipment_section: 'Shipment',
  origin: 'Origin',
  destination: 'Destination',
  importer: 'Importer',
  bol_ref: 'BOL reference',
  carrier: 'Carrier',

  // Customs (M2)
  customs_section: 'Customs validation (US side)',
  hs_classification: 'HS classification',
  origin_status: 'Origin status',
  ligie_status: 'LIGIE 2026 status',
  rvc_status: 'RVC',
  usmca_originating: 'USMCA originating',
  not_originating: 'Not USMCA originating',
  ligie_affected: 'LIGIE-affected',
  ligie_clear: 'LIGIE clear',

  // Pedimento (M11)
  pedimento_section: 'Pedimento (MX side)',
  pedimento_clave: 'Clave (Anexo 22)',
  pedimento_regimen: 'Regimen',
  pedimento_total_contribuciones: 'Total contributions',
  pedimento_fatal_findings: 'Fatal findings',

  // Regulatory (M3)
  regulatory_section: 'Regulatory pre-arrival',
  agencies_required: 'Agencies',
  earliest_deadline: 'Earliest deadline',

  // Paperwork (M4)
  paperwork_section: 'Paperwork extracted',
  documents: 'Documents',
  blocking: 'Blocking issues',

  // Drivers operator (M5)
  drivers_section: 'Driver compliance (operator)',
  overall_status: 'Overall status',
  checks_run: 'Checks',

  // Driver pass (M5 driver-side)
  driver_pass_section: 'Driver pass',
  driver_pass_readiness: 'Readiness',
  driver_pass_blocking: 'Blocking docs',
  driver_pass_expiring: 'Expiring within 30 days',

  // Refunds (M14 IEEPA)
  refunds_section: 'IEEPA refund composition',
  refunds_total_recoverable: 'Total recoverable',
  refunds_cape_eligible: 'CAPE-eligible entries',
  refunds_protest_required: 'Form 19 protest required',
  refunds_registry_version: 'Registry version',

  // Drawback (M7 §1313)
  drawback_section: '§1313 drawback composition',
  drawback_total_recoverable: 'Total drawback recoverable',
  drawback_manufacturing: 'Manufacturing claims',
  drawback_unused: 'Unused-merch claims',
  drawback_rejected: 'Rejected-merch claims',
  drawback_accelerated: 'Accelerated payment eligible',

  // CBAM
  cbam_section: 'EU CBAM composition',
  cbam_phase: 'Phase',
  cbam_in_scope: 'Goods in scope',
  cbam_emissions: 'Total embedded emissions (t CO2e)',
  cbam_certificates: 'Certificates required',
  cbam_cost: 'Estimated CBAM cost',

  // UFLPA
  uflpa_section: 'UFLPA risk evaluation',
  uflpa_risk_level: 'Risk level',
  uflpa_presumption: 'Rebuttable presumption',
  uflpa_xinjiang_tier: 'Xinjiang exposure tier',
  uflpa_evidence: 'Evidence quality',

  // Audit + footer
  audit_shield: 'Audit shield',
  prior_disclosure: 'Prior-disclosure eligible (19 CFR § 162.74)',
  signing_key_id: 'Signing key',
  schema_version: 'Schema version',
  disclaimer: 'This Ticket is operational documentation prepared by Cruzar software. Cruzar is not a licensed customs broker; filings must be reviewed and submitted by the licensed broker / declarant of record. The Ed25519 signature is verifiable against our public key at /.well-known/cruzar-ticket-key.json.',
};
