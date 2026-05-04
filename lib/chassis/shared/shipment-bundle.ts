// lib/chassis/shared/shipment-bundle.ts
// Unified input model for the cross-module orchestrator. The 12 chassis composers
// each take their own input shape, all overlapping but incompatible. This bundle
// is the SUPERSET — fill in what you have, the orchestrator runs every composer
// it has enough data for, and emits a unified MultiModuleComposition.
//
// The "they talk" structural fix: a broker uploads ONE shipment bundle, the
// orchestrator runs IEEPA refunds + §1313 drawback + UFLPA risk + CBAM + customs
// + pedimento + driver-pass + paperwork + regulatory pre-arrival in parallel
// against the same data. Cross-module references surface. ONE Cruzar Ticket
// composes from all of it.

import type { Entry as RefundEntry, IorProfile } from '../refunds/types';
import type {
  DrawbackEntry, DrawbackExport, DrawbackClaimantProfile,
} from '../drawback/types';
import type {
  OperacionInput as PedimentoInput,
  AgenteAduanal, ImportadorExportadorMx, MercanciaPedimento,
} from '../pedimento/types';
import type { CbamGood, CbamDeclarantProfile } from '../cbam/types';
import type { UflpaShipmentInput, SupplyChainTier } from '../uflpa/types';
import type {
  DriverProfile, TripContext, DocRequirement,
} from '../driver-pass/types';

// ── Common identity ────────────────────────────────────────────────────────

export interface PartyIdentity {
  legal_name: string;
  // US identifiers
  ein?: string;                       // IRS Employer ID Number
  cbp_filer_code?: string;            // 3-letter CBP-assigned filer code
  // EU identifier
  eori?: string;                      // EU Economic Operator Registration & ID
  // Mexican identifiers
  rfc?: string;                       // Registro Federal de Contribuyentes
  domicilio_fiscal_estado?: string;   // 2-3 letter MX state code (NLE, TAM, etc.)
  padron_importadores_activo?: boolean;
  programa_immex?: string;
  // EU MDR identifier
  eudamed_actor_id?: string;
  language?: 'en' | 'es';
}

export interface MexicanBroker {
  patente: string;                    // 4-digit SAT customs broker license
  legal_name: string;
  rfc: string;
}

// ── Shipment-level overlap ─────────────────────────────────────────────────

export interface SharedEntry {
  // ACE-level fields (US side)
  entry_number?: string;              // 14-digit ACE entry number
  entry_date: string;                 // ISO date
  liquidation_date?: string | null;
  liquidation_status?: 'unliquidated' | 'liquidated' | 'extended' | 'suspended' | 'final';

  // HTSUS / origin / value
  htsus_codes: string[];
  country_of_origin: string;          // ISO alpha-2
  total_duty_paid_usd: number;
  total_taxes_paid_usd: number;
  total_fees_paid_usd: number;
  total_dutiable_value_usd: number;

  // Per-line duty breakdown (refunds needs Chapter 99 split)
  duty_lines?: Array<{ htsus_code: string; rate_pct: number | null; amount_usd: number; is_chapter_99: boolean }>;

  // Physical
  unit_count: number;
  merchandise_description: string;
}

export interface SharedExport {
  export_id: string;
  export_date: string;
  destination_country: string;        // ISO alpha-2
  htsus_or_schedule_b: string;
  description: string;
  unit_count: number;
  manufacturing_evidence?: 'bill_of_materials' | 'manufacturing_record' | null;
  rejection_evidence?: 'inspection_report' | 'customer_return' | null;
}

// ── Trip / driver overlap ──────────────────────────────────────────────────

export interface SharedTrip {
  origin_country: 'US' | 'MX';
  destination_country: 'US' | 'MX';
  crossing_port_code: string;
  hazmat: boolean;
  perishables: boolean;
  scheduled_eta_iso: string;
}

export interface SharedDriver {
  legal_name: string;
  cdl_number: string;
  cdl_state: string;
  fast_card_number?: string;
  sentri_card_number?: string;
  docs: DocRequirement[];
}

// ── The bundle itself ──────────────────────────────────────────────────────

export interface ShipmentBundle {
  bundle_id: string;                  // caller-supplied stable ID for tracing
  importer: PartyIdentity;
  exporter?: PartyIdentity;           // for export-side modules (drawback, A3 pedimento)
  mexican_broker?: MexicanBroker;     // for pedimento composition
  entries: SharedEntry[];             // import-side entries
  exports: SharedExport[];            // export-side records (drawback, MX A3 export pedimento)
  supply_chain?: SupplyChainTier[];   // UFLPA tier map
  cbam_goods?: CbamGood[];            // EU-bound goods with installation + emissions
  trip?: SharedTrip;                  // driver-pass + crossing context
  driver?: SharedDriver;              // driver-pass docs
  pedimento_mercancias?: MercanciaPedimento[];  // MX-side merchandise lines (override if not derivable)
  pedimento_operation?: 'importacion' | 'exportacion' | 'transito' | 'retorno';
  pedimento_regimen?: 'definitivo' | 'temporal' | 'deposito_fiscal' | 'transito';
  pedimento_aduana_codigo?: string;
  pedimento_fecha_operacion?: string;
}

// ── Bundle → per-module input mappers ──────────────────────────────────────
// Each mapper returns null when the bundle lacks enough data for that module.

export function bundleToRefundsInput(b: ShipmentBundle): { entries: RefundEntry[]; ior: IorProfile } | null {
  const eligibleEntries = b.entries.filter((e) => e.entry_number && e.liquidation_status);
  if (eligibleEntries.length === 0) return null;
  const entries: RefundEntry[] = eligibleEntries.map((e) => ({
    entry_number: e.entry_number!,
    entry_date: e.entry_date,
    liquidation_date: e.liquidation_date ?? null,
    liquidation_status: e.liquidation_status ?? 'unliquidated',
    country_of_origin: e.country_of_origin,
    htsus_codes: e.htsus_codes,
    duty_lines: e.duty_lines ?? [],
    total_duty_paid_usd: e.total_duty_paid_usd,
    total_dutiable_value_usd: e.total_dutiable_value_usd,
  }));
  const ior: IorProfile = {
    ior_name: b.importer.legal_name,
    ior_id_number: b.importer.ein ?? b.importer.cbp_filer_code ?? 'UNKNOWN',
    filer_code: b.importer.cbp_filer_code,
    language: b.importer.language ?? 'en',
  };
  return { entries, ior };
}

export function bundleToDrawbackInput(b: ShipmentBundle): {
  claimant: DrawbackClaimantProfile;
  entries: DrawbackEntry[];
  exports: DrawbackExport[];
} | null {
  if (b.entries.length === 0 || b.exports.length === 0) return null;
  const entries: DrawbackEntry[] = b.entries
    .filter((e) => e.entry_number)
    .map((e) => ({
      entry_number: e.entry_number!,
      entry_date: e.entry_date,
      importer_of_record: b.importer.legal_name,
      htsus_codes: e.htsus_codes,
      total_duty_paid_usd: e.total_duty_paid_usd,
      total_taxes_paid_usd: e.total_taxes_paid_usd,
      total_fees_paid_usd: e.total_fees_paid_usd,
      merchandise_description: e.merchandise_description,
      unit_count: e.unit_count,
    }));
  if (entries.length === 0) return null;
  const claimant: DrawbackClaimantProfile = {
    claimant_name: b.importer.legal_name,
    claimant_id_number: b.importer.ein ?? 'UNKNOWN',
    filer_code: b.importer.cbp_filer_code,
    language: b.importer.language ?? 'en',
    has_accelerated_payment_privilege: false,
    has_drawback_bond: false,
  };
  return { claimant, entries, exports: b.exports };
}

export function bundleToPedimentoInput(b: ShipmentBundle): PedimentoInput | null {
  if (!b.mexican_broker || !b.importer.rfc || !b.pedimento_mercancias || b.pedimento_mercancias.length === 0) {
    return null;
  }
  const agente: AgenteAduanal = {
    patente: b.mexican_broker.patente,
    nombre_o_razon_social: b.mexican_broker.legal_name,
    rfc: b.mexican_broker.rfc,
  };
  const importador: ImportadorExportadorMx = {
    rfc: b.importer.rfc,
    razon_social: b.importer.legal_name,
    domicilio_fiscal_estado: b.importer.domicilio_fiscal_estado ?? 'NLE',
    padron_importadores_activo: b.importer.padron_importadores_activo ?? false,
    programa_immex: b.importer.programa_immex,
  };
  return {
    agente,
    importador_exportador: importador,
    operacion: b.pedimento_operation ?? 'importacion',
    regimen: b.pedimento_regimen ?? 'definitivo',
    aduana_codigo: b.pedimento_aduana_codigo ?? '',
    fecha_operacion: b.pedimento_fecha_operacion ?? new Date().toISOString().slice(0, 10),
    mercancias: b.pedimento_mercancias,
    forma_pago: 'transferencia',
  };
}

export function bundleToCbamInput(b: ShipmentBundle): { declarant: CbamDeclarantProfile; goods: CbamGood[] } | null {
  if (!b.cbam_goods || b.cbam_goods.length === 0 || !b.importer.eori) return null;
  const declarant: CbamDeclarantProfile = {
    declarant_name: b.importer.legal_name,
    declarant_eori: b.importer.eori,
    authorized_cbam_declarant: true,
    reporting_period: deriveReportingPeriod(b.entries[0]?.entry_date ?? new Date().toISOString()),
    language: b.importer.language ?? 'en',
  };
  return { declarant, goods: b.cbam_goods };
}

export function bundleToUflpaInput(b: ShipmentBundle): UflpaShipmentInput | null {
  if (!b.supply_chain || b.supply_chain.length === 0) return null;
  // Use the first entry's HTSUS as the shipment-level code (UFLPA flags by HTSUS chapter)
  const firstEntry = b.entries[0];
  const htsus = firstEntry?.htsus_codes[0] ?? '';
  return {
    importer_name: b.importer.legal_name,
    importer_ein: b.importer.ein ?? 'UNKNOWN',
    htsus_code: htsus,
    product_description: firstEntry?.merchandise_description ?? '',
    expected_arrival_iso: b.trip?.scheduled_eta_iso ?? new Date().toISOString(),
    port_of_entry: b.trip?.crossing_port_code ?? '',
    declared_value_usd: b.entries.reduce((sum, e) => sum + e.total_dutiable_value_usd, 0),
    supply_chain: b.supply_chain,
    total_supplier_traceability_tiers: b.supply_chain.length,
  };
}

export function bundleToDriverPassInput(b: ShipmentBundle): {
  driver: DriverProfile;
  trip: TripContext;
  docs: DocRequirement[];
} | null {
  if (!b.driver || !b.trip) return null;
  const driver: DriverProfile = {
    driver_legal_name: b.driver.legal_name,
    cdl_number: b.driver.cdl_number,
    cdl_state: b.driver.cdl_state,
    language: b.importer.language ?? 'en',
    fast_card_number: b.driver.fast_card_number,
    sentri_card_number: b.driver.sentri_card_number,
  };
  const trip: TripContext = {
    origin_country: b.trip.origin_country,
    destination_country: b.trip.destination_country,
    crossing_port_code: b.trip.crossing_port_code,
    hazmat: b.trip.hazmat,
    perishables: b.trip.perishables,
    scheduled_eta_iso: b.trip.scheduled_eta_iso,
  };
  return { driver, trip, docs: b.driver.docs };
}

function deriveReportingPeriod(iso: string): string {
  const d = new Date(iso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}
