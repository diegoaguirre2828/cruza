// lib/chassis/cbam/types.ts — Module CBAM (EU Carbon Border Adjustment Mechanism)
// Reference: Regulation (EU) 2023/956 + Implementing Regulation 2025/486 (definitive phase from Jan 1, 2026)

export type CbamGoodCategory =
  | 'cement'
  | 'iron_steel'
  | 'aluminum'
  | 'fertilizers'
  | 'electricity'
  | 'hydrogen'
  | 'out_of_scope';

export type CbamPhase = 'transitional' | 'definitive';

export type EmissionsBasis = 'actual_verified' | 'actual_unverified' | 'default_value';

export interface CbamInstallation {
  installation_name: string;
  country_iso: string;            // ISO alpha-2 (production country)
  city?: string;
  has_emissions_monitoring_plan: boolean;
  uses_carbon_price_in_origin: boolean;   // some non-EU regimes already price carbon
  carbon_price_paid_origin_eur_per_t?: number;
}

export interface CbamGood {
  cn_code: string;                // EU Combined Nomenclature 8-digit
  description: string;
  category: CbamGoodCategory;
  mass_tonnes: number;
  installation: CbamInstallation;
  direct_emissions_t_co2_per_t?: number;     // Scope 1 emissions per tonne of good
  indirect_emissions_t_co2_per_t?: number;   // Scope 2 (electricity) emissions per tonne
  emissions_basis: EmissionsBasis;
}

export interface CbamDeclarantProfile {
  declarant_name: string;
  declarant_eori: string;          // EU Economic Operator Registration & ID number
  authorized_cbam_declarant: boolean;
  reporting_period: string;        // 'YYYY-Q1' | 'YYYY-Q2' | etc. (transitional)
  language: 'en' | 'es';
}

export interface CbamComposition {
  declarant_name: string;
  declarant_eori: string;
  authorized: boolean;
  phase: CbamPhase;
  reporting_period: string;
  total_goods: number;
  in_scope_count: number;
  out_of_scope_count: number;
  total_mass_tonnes: number;
  total_embedded_emissions_t_co2: number;  // direct + indirect
  total_direct_emissions_t_co2: number;
  total_indirect_emissions_t_co2: number;
  certificates_required: number;            // 1 cert = 1 t CO2e (definitive only)
  estimated_cbam_cost_eur: number;          // certs × ETS avg auction price
  ets_avg_price_eur_per_t: number;          // current EU ETS auction price reference
  findings: CbamFinding[];
  composed_at: string;
  registry_version: string;
}

export interface CbamFinding {
  rule_id: string;                 // 'CBAM-F-001', 'CBAM-W-002', etc.
  severity: 'fatal' | 'warning' | 'info';
  field?: string;
  message_es: string;
  message_en: string;
}

export interface CbamRegistry {
  version: string;
  phase: CbamPhase;
  ets_reference_price_eur_per_t: number;    // most recent EU ETS auction average
  default_factors_t_co2_per_t: Record<CbamGoodCategory, { direct: number; indirect: number }>;
  cn_code_to_category: Record<string, CbamGoodCategory>;
  references: {
    regulation: string;
    implementing_regulation: string;
    transitional_start: string;
    definitive_start: string;
  };
}
