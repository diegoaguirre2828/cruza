// lib/chassis/drawback/types.ts — Module 7 US Drawback (§1313) chassis schemas

export type DrawbackClaimType =
  | 'manufacturing_direct'      // §1313(a) — direct identification, imports used in producing exports
  | 'manufacturing_substitution' // §1313(b) — substituted commercially-interchangeable merch
  | 'unused_direct'             // §1313(j)(1) — imports re-exported in same condition
  | 'unused_substitution'       // §1313(j)(2) — substituted unused commercially-interchangeable merch
  | 'rejected'                  // §1313(c) — defective / non-conforming returns within 5 yrs
  | 'ineligible';

export type DrawbackIneligibilityReason =
  | 'past_5yr_window'
  | 'no_export_evidence'
  | 'commercial_interchangeability_unproven'
  | 'designation_already_claimed'
  | 'duty_paid_zero'
  | 'merchandise_consumed_domestically';

export interface DrawbackEntry {
  entry_number: string;            // 14-digit ACE entry number
  entry_date: string;              // ISO 8601
  importer_of_record: string;
  htsus_codes: string[];
  total_duty_paid_usd: number;
  total_taxes_paid_usd: number;    // includes IRS taxes (alcohol/tobacco)
  total_fees_paid_usd: number;     // MPF + HMF
  merchandise_description: string;
  unit_count: number;
}

export interface DrawbackExport {
  export_id: string;               // bill of lading or AES filing reference
  export_date: string;             // ISO 8601
  destination_country: string;     // ISO alpha-2
  htsus_or_schedule_b: string;     // schedule B for exports
  description: string;
  unit_count: number;
  manufacturing_evidence?: 'bill_of_materials' | 'manufacturing_record' | null;
  rejection_evidence?: 'inspection_report' | 'customer_return' | null;
}

export interface DrawbackDesignation {
  entry_number: string;
  export_id: string;
  designated_units: number;
  claim_type: DrawbackClaimType;
  ineligibility_reason: DrawbackIneligibilityReason | null;
  refund_basis_usd: number;        // duty + tax + fee that 99% will be applied to
  reason: string;
}

export interface DrawbackClaimantProfile {
  claimant_name: string;
  claimant_id_number: string;      // IRS / EIN / CBP filer code
  filer_code?: string;
  language: 'en' | 'es';
  has_accelerated_payment_privilege: boolean;
  has_drawback_bond: boolean;
}

export interface DrawbackComposition {
  claimant_name: string;
  claimant_id_number: string;
  total_entries: number;
  total_exports: number;
  total_designations: number;
  manufacturing_count: number;
  unused_count: number;
  rejected_count: number;
  ineligible_count: number;
  total_refund_basis_usd: number;
  total_drawback_recoverable_usd: number;   // 99% of basis
  estimated_cruzar_fee_usd: number;
  accelerated_payment_eligible: boolean;
  registry_version: string;
  composed_at: string;
  designations: DrawbackDesignation[];
  validation_warnings: DrawbackValidationWarning[];
}

export interface DrawbackValidationWarning {
  rule_id: string;                  // 'DBK-W-001', 'DBK-E-014', etc.
  severity: 'fatal' | 'warning' | 'info';
  entry_number?: string;
  export_id?: string;
  message: string;
}

export interface DrawbackRegistry {
  version: string;
  refund_rate: number;              // 0.99 (statutory)
  filing_window_years: number;      // 5
  accelerated_payment_weeks: number; // ~3
  standard_payment_weeks: number;    // ~52
  bond_required_for_accelerated: boolean;
  statutory_references: {
    manufacturing: string;          // '19 USC §1313(a)' / '19 USC §1313(b)'
    unused: string;                 // '19 USC §1313(j)'
    rejected: string;               // '19 USC §1313(c)'
    tftea_reform: string;           // 'TFTEA 2016 — Public Law 114-125'
  };
}
