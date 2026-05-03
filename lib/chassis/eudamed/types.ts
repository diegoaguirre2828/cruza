// lib/chassis/eudamed/types.ts — EU MDR / EUDAMED actor + device-data feed
//
// EUDAMED = European Database on Medical Devices. Four modules go mandatory
// 28 May 2026 under EU Regulation 2017/745 (MDR) and 2017/746 (IVDR):
//   1. Actor module — Single Registration Number (SRN) per legal entity
//   2. UDI / Device module — Unique Device Identifier per device
//   3. Notified Bodies — certificates issued
//   4. Market Surveillance — vigilance reports
//
// Cruzar's wedge: capture UDI + device class + actor SRN during cross-border
// customs events, output JSON/CSV the OEM compliance team can drop into the
// EUDAMED Actor + UDI/Device modules. We do NOT submit to EUDAMED on behalf
// of any party — same H350722 / DeWalt-frame substrate position as the rest
// of the chassis: we prepare, the responsible party (manufacturer's
// authorized rep / EUDAMED-registered actor) submits.

/** EU MDR risk classes (Annex VIII rules 1-22). IVDR uses A/B/C/D separately. */
export type DeviceRiskClass =
  | 'I'           // Lowest risk (e.g., bandages, walking aids). Self-declaration.
  | 'I_sterile'   // Class I supplied sterile — NB involvement required for sterilization.
  | 'I_measuring' // Class I with measuring function — NB involvement.
  | 'I_reusable'  // Class I reusable surgical instrument — MDR uplift.
  | 'IIa'         // Medium risk (e.g., contact lenses, dental fillings). NB involvement.
  | 'IIb'         // Higher risk (e.g., infusion pumps, ventilators). NB involvement.
  | 'III'         // Highest risk (e.g., heart valves, joint implants). Full NB review.
  | 'AIMD'        // Active Implantable Medical Device — historically separate, now MDR.
  | 'IVD_A'       // IVDR Class A — lowest IVD risk (general lab reagents).
  | 'IVD_B'       // IVDR Class B — moderate IVD (pregnancy tests).
  | 'IVD_C'       // IVDR Class C — higher IVD (HIV, HCV, blood typing).
  | 'IVD_D';      // IVDR Class D — highest IVD (HIV/HCV/HBV blood-screening).

/** Actor roles per EUDAMED Actor module. */
export type EudamedActorRole =
  | 'manufacturer'              // Legal manufacturer — ultimate MDR/IVDR responsibility.
  | 'authorized_representative' // EU-based AR for non-EU manufacturers (Article 11).
  | 'importer'                  // Places device on EU market (Article 13).
  | 'distributor'               // Makes available downstream (Article 14).
  | 'system_procedure_pack_producer'  // Article 22 — combines devices into systems.
  | 'sterilizer';               // Sterilizes devices supplied non-sterile.

/** Actor identification per EUDAMED. SRN issued by competent authority. */
export interface EudamedActor {
  legal_name: string;
  trade_name?: string;
  role: EudamedActorRole;
  /** Single Registration Number — issued by the EUDAMED competent authority.
   *  Format: 2-letter country + sequential numeric ID (e.g., "DE-MF-000012345").
   *  null if actor has not yet completed initial EUDAMED actor registration —
   *  Cruzar's onboarding helps generate the data needed to apply for one. */
  srn: string | null;
  registration_country_iso: string;          // ISO 3166-1 alpha-2 (e.g., "DE", "FR", "MX")
  vat_or_tax_id?: string;
  address: {
    street: string;
    city: string;
    postal_code: string;
    country_iso: string;
  };
  contact_email: string;
  /** EU AR is required for non-EU manufacturers (Article 11). If role !=
   *  authorized_representative AND registration_country_iso is non-EU, this
   *  field captures the AR's SRN for cross-reference. */
  authorized_rep_srn?: string;
}

/** UDI = Unique Device Identifier. Two parts per ISO/IEC 15459: DI (static)
 *  + PI (dynamic per production unit). */
export interface UdiDi {
  /** Issuing entity — GS1 (most common globally), HIBCC (US healthcare),
   *  ICCBBA (blood/cells), IFA Coding System (DE pharmaceuticals). */
  issuing_agency: 'GS1' | 'HIBCC' | 'ICCBBA' | 'IFA';
  /** The static device identifier — typically a 14-digit GTIN under GS1. */
  di_value: string;
  /** Brand / trade name as it appears on labelling. */
  brand_name: string;
  /** Model / catalogue number from the labelling. */
  model_or_reference_number: string;
}

export interface UdiPi {
  /** Production identifier components. At least one must be present per the
   *  EUDAMED UDI module spec. Captured per shipment / lot crossing the border. */
  lot_number?: string;
  serial_number?: string;
  manufacturing_date?: string;       // ISO 8601 date (YYYY-MM-DD)
  expiry_date?: string;              // ISO 8601 date
  software_version?: string;         // For software medical devices (SaMD).
}

/** Single device record combining DI + PI + classification + EUDAMED metadata. */
export interface EudamedDevice {
  udi_di: UdiDi;
  udi_pi: UdiPi;
  /** GMDN — Global Medical Device Nomenclature term + 5-digit code. */
  gmdn_code: string;
  gmdn_term: string;
  risk_class: DeviceRiskClass;
  /** True for devices supplied sterile, requires sterilization actor. */
  is_sterile: boolean;
  /** True for devices with measuring function — Annex VIII Rule 10. */
  has_measuring_function: boolean;
  /** True for active implantable / Class III — additional disclosure rules. */
  is_active_implantable: boolean;
  /** EU Notified Body identification number (4-digit) issuing the CE certificate.
   *  null for self-declaration Class I. */
  notified_body_id: string | null;
  /** CE marking status as captured at the cross-border event. */
  ce_marking_status: 'declared' | 'in_transition_mdd_to_mdr' | 'expired' | 'unmarked';
  /** Manufacturer's catalogue / item number — links Cruzar Ticket to the OEM
   *  PLM/ERP record. Critical for OEM compliance teams to resolve our feed
   *  against their internal device master. */
  manufacturer_catalogue_number?: string;
}

export interface EudamedSubmissionInput {
  actor: EudamedActor;
  /** Devices being declared. For Cruzar's substrate role, this is typically
   *  the set of devices manifested on a single border crossing — but the same
   *  composer handles multi-shipment batch exports. */
  devices: EudamedDevice[];
  /** ISO 8601 timestamp of the underlying customs event(s) the data was
   *  captured at. Used to scope EUDAMED submissions per quarter / per lot. */
  captured_at: string;
}

export interface EudamedActorRegistrationOutput {
  /** JSON shaped to align with EUDAMED Actor-module field names. The CSV/JSON
   *  is uploaded by the OEM compliance team; Cruzar never submits. */
  payload: {
    actor_legal_name: string;
    actor_trade_name?: string;
    actor_role: EudamedActorRole;
    srn: string | null;
    registration_country: string;
    vat_or_tax_id?: string;
    address_line: string;
    city: string;
    postal_code: string;
    country: string;
    contact_email: string;
    authorized_rep_srn?: string;
  };
  /** True iff actor has all required fields populated to complete actor
   *  registration in EUDAMED. False = onboarding incomplete; surface what's
   *  missing in the validation_warnings array. */
  is_submission_ready: boolean;
  validation_warnings: string[];
  generated_at: string;
}

export interface EudamedUdiCsvRow {
  udi_di: string;
  brand_name: string;
  model_reference: string;
  gmdn_code: string;
  gmdn_term: string;
  risk_class: DeviceRiskClass;
  is_sterile: 'yes' | 'no';
  has_measuring_function: 'yes' | 'no';
  is_active_implantable: 'yes' | 'no';
  notified_body_id: string;
  ce_marking_status: string;
  manufacturer_catalogue_number: string;
  lot_number: string;
  serial_number: string;
  manufacturing_date: string;
  expiry_date: string;
  software_version: string;
  captured_at: string;
}

export interface EudamedComposition {
  actor_registration: EudamedActorRegistrationOutput;
  /** CSV string ready for upload to the EUDAMED UDI/Device module. */
  udi_csv: string;
  /** SHA-256 hex of the CSV payload — for Ticket signature integrity. */
  udi_csv_signature: string;
  /** Per-device validation results — flags devices that are missing required
   *  fields and would be rejected by EUDAMED. */
  device_validation: Array<{
    udi_di: string;
    valid: boolean;
    missing_fields: string[];
  }>;
  device_count: number;
  ready_count: number;
  blocked_count: number;
  composed_at: string;
  registry_version: string;
}

export class EudamedScreeningBlockedError extends Error {
  device_di: string;
  reason: string;
  constructor(message: string, device_di: string, reason: string) {
    super(message);
    this.name = 'EudamedScreeningBlockedError';
    this.device_di = device_di;
    this.reason = reason;
  }
}
