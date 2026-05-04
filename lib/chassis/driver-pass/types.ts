// lib/chassis/driver-pass/types.ts — Module Driver Pass: per-trip readiness composition
// Different from M5 Drivers compliance (HOS / IMSS / Annex 31-A — operator-side legal).
// This module assembles the DRIVER-side per-trip pass: identity docs + commercial entry
// checklist + crossing assignment + emergency-script reference. Output is a payload the
// driver carries (Apple Wallet pass, QR, link). The pass composes onto the Cruzar Ticket
// so the same shipment can carry the driver-pass block alongside customs / pedimento /
// regulatory blocks.

export type DocCategory =
  | 'identity'              // CDL, passport, FAST, SENTRI
  | 'medical'               // DOT medical card, drug test
  | 'security'              // TWIC, HAZMAT endorsement
  | 'mexican_entry'         // FMM, FMC, IMSS card, INM permit
  | 'commercial'            // CDL endorsements, IRP cab card
  | 'company';              // employer letter, insurance card

export type DocStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing';

export type ReadinessLevel = 'ready' | 'partial' | 'blocked';

export interface DocRequirement {
  doc_id: string;                 // 'cdl', 'twic', 'fast', 'medical', 'fmm', etc.
  category: DocCategory;
  label_en: string;
  label_es: string;
  required_for: Array<'us_entry' | 'mx_entry' | 'commercial' | 'hazmat'>;
  expiry_date?: string;           // ISO date — optional if missing
  cardholder_id?: string;         // license #, TWIC #, etc.
}

export interface TripContext {
  origin_country: 'US' | 'MX';
  destination_country: 'US' | 'MX';
  crossing_port_code: string;     // CBP port-of-entry code or aduana code
  hazmat: boolean;
  perishables: boolean;
  scheduled_eta_iso: string;
  ticket_id_ref?: string;         // optional Cruzar Ticket id this trip composes against
}

export interface DriverProfile {
  driver_legal_name: string;
  cdl_number: string;
  cdl_state: string;              // 2-letter US state issuing CDL
  language: 'en' | 'es';
  fast_card_number?: string;
  sentri_card_number?: string;
}

export interface DocFinding {
  doc_id: string;
  status: DocStatus;
  days_to_expiry: number | null;
  message_en: string;
  message_es: string;
}

export interface DriverPassComposition {
  driver_legal_name: string;
  cdl_number: string;
  trip: TripContext;
  readiness: ReadinessLevel;
  doc_findings: DocFinding[];
  blocking_doc_count: number;
  expiring_soon_doc_count: number;
  recommended_actions: string[];
  pass_payload: {
    pass_type: 'cruzar.driver-pass.v1';
    driver: { name: string; cdl: string };
    trip: TripContext;
    composed_at: string;
    docs_summary: Array<{ doc_id: string; status: DocStatus }>;
  };
  composed_at: string;
  registry_version: string;
}

export interface DriverPassRegistry {
  version: string;
  expiring_soon_window_days: number;     // 30 — flag docs within this window
  required_docs_us_entry: string[];      // doc_ids required to enter US (commercial)
  required_docs_mx_entry: string[];      // doc_ids required to enter MX (commercial)
  hazmat_extra_docs: string[];           // docs added when hazmat
  references: {
    cdl: string;
    twic: string;
    medical: string;
    fast_sentri: string;
    fmm: string;
  };
}
