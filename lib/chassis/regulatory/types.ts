// lib/chassis/regulatory/types.ts
// Module 3 — pre-arrival regulatory notification schemas.
// Agencies: FDA Prior Notice (food/medical), USDA APHIS (plant/animal),
//           CBP ISF 10+2 (ocean), CBP 7501 (entry summary).

import type { ShipmentInput } from '../customs/types';
import type { HsClassificationResult, OriginValidationResult, RvcResult } from '../customs/types';

export type AgencyId = 'FDA' | 'USDA' | 'CBP_ISF' | 'CBP_7501';

// ── FDA Prior Notice ────────────────────────────────────────────────────────
export interface FdaPriorNoticeComposition {
  required: boolean;
  reason_required: string;                 // human-readable why FDA Prior Notice applies
  product_code: string | null;             // FDA product code (5-7 char alphanumeric)
  arrival_deadline_iso: string | null;     // ISO timestamp = arrival_eta - 2h (FDA rule)
  fields: {
    submitter: { name: string; address: string; phone?: string };
    transmitter?: { name: string; address: string };
    importer: { name: string; address: string; iei?: string };
    owner: { name: string; address: string };
    consignee: { name: string; address: string };
    arrival_information: {
      port_of_entry_code: string;
      arrival_date_eta_iso: string;
      mode_of_transport: 'truck' | 'ocean' | 'air' | 'rail';
      carrier: string;
    };
    article: {
      product_code: string;
      common_name: string;
      hts_10: string;
      country_of_production: string;
      manufacturer_facility?: string;
      grower_facility?: string;
      quantity: { amount: number; unit: string };
    };
  };
  manifest_notes: string[];                // human-readable broker action items
}

// ── USDA APHIS ─────────────────────────────────────────────────────────────
export interface UsdaAphisComposition {
  required: boolean;
  reason_required: string;
  forms_applicable: Array<'PPQ_587' | 'PPQ_925'>;
  fields: {
    importer: { name: string; address: string };
    consignee: { name: string; address: string };
    origin_country: string;
    port_of_entry: string;
    arrival_date_eta_iso: string;
    species_or_commodity: string;
    quantity: { amount: number; unit: string };
    treatment_required?: 'fumigation' | 'cold' | 'heat' | 'none';
  };
  manifest_notes: string[];
}

// ── ISF 10+2 (Importer Security Filing) ────────────────────────────────────
export interface IsfElement {
  // 12 elements: 10 from importer + 2 from carrier
  manufacturer_supplier?: { name: string; address: string };
  seller?: { name: string; address: string };
  buyer?: { name: string; address: string };
  ship_to_party?: { name: string; address: string };
  container_stuffing_location?: string;
  consolidator_stuffer?: { name: string; address: string };
  importer_of_record_number?: string;
  consignee_number?: string;
  country_of_origin?: string;
  hts_6?: string;
  // Carrier-supplied (2 elements):
  vessel_stow_plan?: string;
  container_status_message?: string;
}

export interface IsfComposition {
  required: boolean;
  reason_required: string;                  // typically: "ocean shipment"
  loading_deadline_iso: string | null;      // ISO timestamp = vessel_load_time - 24h (ISF rule)
  elements: IsfElement;
  elements_complete: { importer_count: number; carrier_count: number };
  manifest_notes: string[];
}

// ── CBP 7501 (Entry Summary) ───────────────────────────────────────────────
export interface Cbp7501Composition {
  required: true;                           // every commercial entry needs CF-7501
  filing_deadline_iso: string;              // ISO timestamp = entry_date + 10 business days
  fields: {
    entry_number?: string;                  // assigned by ACE on filing
    entry_type: '01' | '02' | '03' | '11';  // 01 = consumption, 02 = consumption-quota, 03 = informal, 11 = informal-quota
    importer_of_record: { name: string; ein: string };
    importer_address: string;
    consignee?: { name: string; address: string };
    bond_information?: { surety_code?: string; bond_value_usd?: number };
    port_of_entry_code: string;
    entry_date_iso: string;
    arrival_date_iso: string;
    mode_of_transport: string;
    bill_of_lading?: string;
    invoice_total_usd: number;
    line_items: Array<{
      hts_10: string;
      description: string;
      quantity: number;
      unit: string;
      value_usd: number;
      duty_rate_pct: number;
      duty_usd: number;
      fta_claimed: 'USMCA' | 'GSP' | 'CBI' | 'NONE';
      fta_criterion?: 'A' | 'B' | 'C' | 'D';
    }>;
    invoice_total: number;
    duty_total: number;
    fta_savings_usd: number;
  };
  manifest_notes: string[];
}

// ── Submission Manifest ────────────────────────────────────────────────────
export interface SubmissionManifest {
  shipment_ref: string | null;
  agencies_required: AgencyId[];
  fda?: FdaPriorNoticeComposition;
  usda?: UsdaAphisComposition;
  isf?: IsfComposition;
  cbp_7501?: Cbp7501Composition;
  earliest_deadline_iso: string | null;     // earliest of all deadlines (broker file-by)
  composed_at_iso: string;
  ticket_id: string | null;
}

// Routing input — the chassis decides which agencies apply.
export interface RoutingInput {
  shipment: ShipmentInput;
  hs: HsClassificationResult;
  origin: OriginValidationResult;
  rvc: RvcResult;
  arrival_eta_iso: string;                   // when truck/vessel arrives at port
  vessel_load_iso?: string;                  // for ocean — when foreign port loads
  mode_of_transport: 'truck' | 'ocean' | 'air' | 'rail';
}
