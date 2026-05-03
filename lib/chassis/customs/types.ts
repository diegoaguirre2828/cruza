// lib/chassis/customs/types.ts
// Common types for the customs validation chassis (Module 2).
// Imported by hs-classifier, origin-validator, rvc-calculator, ticket/generate.

export type ConfidenceScore = number; // 0.0 - 1.0

export interface BomLineItem {
  description: string;
  hs6: string;                    // 6-digit HS for input components
  origin_country: string;         // ISO-2
  value_usd: number;
  quantity?: number;
  unit?: string;
}

export interface ShipmentInput {
  product_description: string;
  declared_hs10?: string;         // optional manufacturer-provided
  origin_country: string;         // ISO-2
  destination_country: string;
  port_of_entry?: string;
  bom: BomLineItem[];
  transaction_value_usd: number;
  net_cost_usd?: number;
  invoice_number?: string;
  bol_ref?: string;
  shipment_ref?: string;
  importer_name?: string;
}

export interface HsClassificationResult {
  hts_10: string;                 // recommended 10-digit HTS
  hs_6: string;                   // first 6 digits
  description: string;
  gri_path: string;               // human-readable GRI rationale
  gri_rules_applied: Array<'1' | '2(a)' | '2(b)' | '3(a)' | '3(b)' | '3(c)' | '4' | '5' | '6'>;
  alternatives_considered: Array<{ hts_10: string; rejected_because: string }>;
  cbp_cross_refs: string[];       // ruling numbers
  confidence: ConfidenceScore;
}

export interface LigieFlagResult {
  affected: boolean;
  tariff_line: string | null;     // matching LIGIE entry
  rate_pct: number | null;        // hike rate (5% - 50%)
  origin_blocked: string | null;  // which non-FTA origin triggered
  source_ref: 'DOF-5777376';
}

export interface OriginValidationResult {
  usmca_originating: boolean;
  rule_applied: 'tariff_shift' | 'rvc' | 'wholly_obtained' | 'mixed';
  ligie: LigieFlagResult;
  preferential_rate_pct: number;  // 0 if USMCA
  mfn_rate_pct: number;           // most-favored-nation fallback
  effective_rate_pct: number;     // max(LIGIE if applicable, else preferential or MFN)
  certificate_origin_draft: UsmcaCertification | null;
  confidence: ConfidenceScore;
}

export interface UsmcaCertification {
  // USMCA Article 5.2 — 9 required data elements
  certifier_role: 'IMPORTER' | 'EXPORTER' | 'PRODUCER';
  certifier_name: string;
  certifier_address: string;
  exporter_name: string;
  producer_name: string;
  importer_name: string;
  hs_classification: string;
  origin_criterion: 'A' | 'B' | 'C' | 'D';
  blanket_period?: { start: string; end: string };
  authorized_signature_required: true;
}

export interface RvcResult {
  transaction_value_pct: number | null; // RVC under TV method
  net_cost_pct: number | null;          // RVC under NC method
  recommended_method: 'tv' | 'nc' | 'either';
  threshold_required: number;            // e.g. 60 for most goods, 75 for autos
  threshold_met: boolean;
  vnm_total_usd: number;                 // value of non-originating materials
  supporting_doc_manifest: string[];     // what records to retain
}

export interface ChassisCallLog {
  call_type: 'hs_classify' | 'origin_validate' | 'rvc_calculate';
  shipment_ref: string | null;
  ticket_id: string | null;
  input_payload: unknown;
  output_payload: unknown;
  confidence: ConfidenceScore;
  duration_ms: number;
  caller: string;
}
