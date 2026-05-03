// lib/chassis/drivers/types.ts
// Module 5 — driver-side compliance schemas.
// v1 = deterministic rule-based checks + flag-with-disclaimer manifest.
// NOT legal opinion. Disclaimer surfaces on every check output.

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'flagged' | 'inconclusive';

export type CheckType =
  | 'usmca_annex_31a'
  | 'imss'
  | 'hos'
  | 'drug_testing'
  | 'drayage_classification';

// ── Driver record (broker-supplied) ─────────────────────────────────────────
export interface DriverRecord {
  driver_ref: string;                           // broker-supplied identifier (no PII required)
  primary_jurisdiction: 'US' | 'MX' | 'BOTH';
  cdl_class?: 'A' | 'B' | 'C';
  imss_active?: boolean;
  imss_last_payment_iso?: string;
  last_drug_test_iso?: string;
  last_drug_test_jurisdiction?: 'US_DOT' | 'MX_SCT' | 'BOTH';
  employment_classification?: 'W2' | '1099' | 'unknown';
  uses_own_truck?: boolean;
  sets_own_schedule?: boolean;
  works_for_other_carriers?: boolean;
  carries_independent_business_expenses?: boolean;
  paid_per_mile?: boolean;
  paid_hourly?: boolean;
  has_own_dot_authority?: boolean;
}

// ── HOS log entry ───────────────────────────────────────────────────────────
export interface HosLogEntry {
  date_iso: string;
  driving_hours: number;
  on_duty_hours: number;
  rest_hours_prior: number;
  cycle_hours_last_7_or_8_days: number;
}

// ── Per-check results ──────────────────────────────────────────────────────
export interface UsmcaAnnex31AResult {
  compliant: ComplianceStatus;
  reason: string;
  facility_attestation_present: boolean;
  collective_bargaining_compliant: boolean;
  manifest_notes: string[];
}

export interface ImssResult {
  compliant: ComplianceStatus;
  reason: string;
  days_since_last_payment: number | null;
  payment_status: 'current' | 'lapsed_30' | 'lapsed_60_plus' | 'unknown' | 'not_applicable';
  manifest_notes: string[];
}

export interface HosResult {
  compliant: ComplianceStatus;
  reason: string;
  us_dot: {
    within_11h_driving: boolean;
    within_14h_on_duty: boolean;
    within_70h_8day_cycle: boolean;
    rest_break_required: boolean;
    cycle_reset_eligible: boolean;              // 34h consecutive off-duty restart per 49 CFR §395.3(c)
  };
  mx_sct: {
    within_8h_driving: boolean;
    within_9h_on_duty: boolean;
    within_14h_rest_break_compliance: boolean;
  };
  divergence_flag: boolean;
  manifest_notes: string[];
}

export interface DrugTestingResult {
  compliant: ComplianceStatus;
  reason: string;
  days_since_last_test: number | null;
  test_currency: 'current' | 'expiring_soon' | 'expired' | 'unknown';
  jurisdiction_match: boolean;
  equivalency_required: boolean;
  manifest_notes: string[];
}

export interface DrayageClassificationResult {
  compliant: ComplianceStatus;
  reason: string;
  borello_score: number;
  classification_recommendation: 'W2' | '1099' | 'borderline_review';
  declared_classification: 'W2' | '1099' | 'unknown';
  classification_match: boolean;
  paga_risk_estimate_usd: number;
  manifest_notes: string[];
}

// ── Composer / manifest ─────────────────────────────────────────────────────
export interface DriverComplianceInput {
  driver: DriverRecord;
  shipment_ref: string | null;
  shipment_route: 'US_only' | 'MX_only' | 'cross_border';
  hos_log?: HosLogEntry;
  facility_attestation_uploaded?: boolean;
}

export interface DriverComplianceManifest {
  driver_ref: string;
  shipment_ref: string | null;
  checks_run: CheckType[];
  usmca_annex_31a?: UsmcaAnnex31AResult;
  imss?: ImssResult;
  hos?: HosResult;
  drug_testing?: DrugTestingResult;
  drayage_classification?: DrayageClassificationResult;
  overall_status: ComplianceStatus;
  blocking_issues: string[];
  composed_at_iso: string;
  ticket_id: string | null;
  disclaimer: string;
}
