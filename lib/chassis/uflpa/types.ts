// lib/chassis/uflpa/types.ts — Module UFLPA (Uyghur Forced Labor Prevention Act)
// Reference: Public Law 117-78 (June 21, 2022) + UFLPA Strategy + CBP Operational Guidance

export type UflpaRiskLevel = 'high' | 'medium' | 'low' | 'unknown';

export type HighRiskSector =
  | 'cotton_apparel'
  | 'polysilicon_solar'
  | 'tomatoes_food'
  | 'electronics_semiconductors'
  | 'automotive_parts'
  | 'lithium_batteries'
  | 'aluminum'
  | 'pvc_chemicals'
  | 'rubber'
  | 'none';

export type RebuttableEvidenceQuality =
  | 'clear_and_convincing'
  | 'preponderant'
  | 'circumstantial'
  | 'absent';

export interface SupplyChainTier {
  tier: 0 | 1 | 2 | 3 | 4;          // 0 = direct supplier, 1+ = upstream
  supplier_name: string;
  country_iso: string;
  province_or_state?: string;        // critical for Xinjiang detection
  facility_name?: string;
  is_on_uflpa_entity_list: boolean;  // CBP-published list of barred entities
  produced_in_xinjiang: boolean;
  audit_evidence_present: boolean;
  affidavit_present: boolean;
}

export interface UflpaShipmentInput {
  importer_name: string;
  importer_ein: string;
  htsus_code: string;
  product_description: string;
  expected_arrival_iso: string;
  port_of_entry: string;
  declared_value_usd: number;
  supply_chain: SupplyChainTier[];
  total_supplier_traceability_tiers: number;
}

export interface UflpaRiskFinding {
  rule_id: string;                   // 'UFLPA-F-001', 'UFLPA-W-002', etc.
  severity: 'fatal' | 'warning' | 'info';
  field?: string;
  message_es: string;
  message_en: string;
}

export interface UflpaComposition {
  importer_name: string;
  importer_ein: string;
  risk_level: UflpaRiskLevel;
  rebuttable_presumption_triggered: boolean;
  high_risk_sectors_detected: HighRiskSector[];
  xinjiang_tier: number | null;            // depth at which Xinjiang origin appears (null = not found)
  entity_list_hits: Array<{ tier: number; supplier: string }>;
  evidence_quality: RebuttableEvidenceQuality;
  required_actions: string[];              // bilingual recommendations
  findings: UflpaRiskFinding[];
  composed_at: string;
  registry_version: string;
}

export interface UflpaRegistry {
  version: string;
  effective_date: string;                  // 2022-06-21
  enforcement_agency: string;              // 'U.S. Customs and Border Protection'
  htsus_high_risk_chapter_prefixes: Array<{ prefix: string; sector: HighRiskSector; reason: string }>;
  // Sample UFLPA Entity List — CBP publishes the canonical list, ~75 entities as of 2026.
  // For the shallow stub we ship a small representative slice; production should sync from
  // https://www.dhs.gov/uflpa-entity-list weekly.
  sample_entity_list: Array<{ name: string; aliases: string[] }>;
}
