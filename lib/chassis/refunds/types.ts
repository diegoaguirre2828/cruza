// lib/chassis/refunds/types.ts — Module 14 IEEPA Refund Composer schemas

export type LiquidationStatus =
  | 'unliquidated'
  | 'liquidated'
  | 'extended'
  | 'suspended'
  | 'final';

export type CliffStatus =
  | 'cape_eligible'        // unliquidated OR liquidated within 80 days
  | 'protest_required'     // liquidated 81-180 days ago
  | 'past_protest_window'  // liquidated > 180 days ago
  | 'ineligible';          // AD/CVD, drawback-flagged, reconciliation-flagged, etc.

export type ClaimStatus =
  | 'draft'
  | 'validated'
  | 'submitted_to_ace'
  | 'accepted_by_cbp'
  | 'refund_in_transit'
  | 'refund_received'
  | 'rejected';

export interface Entry {
  entry_number: string;            // 14-digit ACE entry number
  entry_date: string;              // ISO 8601 date
  liquidation_date: string | null;
  liquidation_status: LiquidationStatus;
  country_of_origin: string;       // ISO 3166 alpha-2
  htsus_codes: string[];           // primary HTS + Chapter 99 IEEPA + Section 232/301 codes
  duty_lines: DutyLine[];          // every duty/tariff line on the entry
  total_duty_paid_usd: number;
  total_dutiable_value_usd: number;
}

export interface DutyLine {
  htsus_code: string;
  rate_pct: number | null;
  amount_usd: number;
  is_chapter_99: boolean;          // 9903.xx — IEEPA + Section 232 + Section 301
}

export interface IeepaClassification {
  entry_number: string;
  is_ieepa_eligible: boolean;
  applicable_eo: string | null;      // 14193, 14194, 14195, 14257
  ieepa_chapter_99_codes: string[];
  ieepa_principal_usd: number;
  reason: string;
}

export interface StackingSplit {
  entry_number: string;
  ieepa_portion_usd: number;
  section_232_portion_usd: number;
  section_301_portion_usd: number;
  unrelated_duty_usd: number;
}

export interface InterestCalculation {
  entry_number: string;
  principal_usd: number;
  paid_at: string;                  // ISO 8601
  computed_through: string;
  interest_usd: number;
  rate_periods: { quarter: string; rate_pct: number; days: number }[];
}

export interface CliffRouting {
  entry_number: string;
  cliff_status: CliffStatus;
  days_since_liquidation: number | null;
  protest_deadline: string | null;
  reason: string;
}

export interface CapeCsvRow {
  entry_number: string;             // CBP template requires only entry numbers
}

export interface CapeValidationError {
  entry_number: string;
  rule_id: string;                  // 'VAL-F-001', 'VAL-E-014', 'VAL-I-022', etc.
  severity: 'fatal' | 'error' | 'info';
  message: string;
}

export interface Form19Field {
  entry_number: string;
  liquidation_date: string;
  amount_protested_usd: number;
  decision_protested: string;        // "Liquidation including IEEPA duties"
  legal_basis: string;               // "Learning Resources v. Trump (2026); IEEPA does not authorize tariff imposition"
  protest_deadline: string;
}

export interface RefundComposition {
  ior_name: string;
  ior_id_number: string;
  filer_code?: string;
  total_entries: number;
  cape_eligible_count: number;
  protest_required_count: number;
  past_protest_window_count: number;
  ineligible_count: number;
  total_principal_recoverable_usd: number;
  total_interest_recoverable_usd: number;
  total_recoverable_usd: number;
  estimated_cruzar_fee_usd: number;
  cape_csv: string;                  // composed CBP CSV
  cape_csv_signature: string;        // SHA-256 hex
  form19_packet_pdf?: Uint8Array;
  form19_packet_signature?: string;
  validation_errors: CapeValidationError[];
  composed_at: string;
  registry_version: string;          // ieepa-chapter-99.json version used
  screening?: {
    blocked: boolean;
    source: 'ofac_sdn';
    list_version: string;
    hits: Array<{ name_match: string; match_score: number; list_entry_uid: string; list_entry_program: string }>;
  };
}

export class ScreeningBlockedError extends Error {
  hits: Array<{ name_match: string; match_score: number; list_entry_uid: string; list_entry_program: string }>;
  list_version: string;
  constructor(message: string, hits: ScreeningBlockedError['hits'], list_version: string) {
    super(message);
    this.name = 'ScreeningBlockedError';
    this.hits = hits;
    this.list_version = list_version;
  }
}

export interface IorProfile {
  ior_name: string;
  ior_id_number: string;
  filer_code?: string;
  language: 'en' | 'es';
}
