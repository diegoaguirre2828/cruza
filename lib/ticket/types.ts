// lib/ticket/types.ts
import type { HsClassificationResult, OriginValidationResult, RvcResult, UsmcaCertification } from '../chassis/customs/types';
import type { SubmissionManifest, AgencyId } from '../chassis/regulatory/types';
import type { PaperworkComposition } from '../chassis/docs/types';
import type { DriverComplianceManifest, ComplianceStatus } from '../chassis/drivers/types';
import type { RefundComposition } from '../chassis/refunds/types';
import type { DrawbackComposition } from '../chassis/drawback/types';
import type { PedimentoComposition } from '../chassis/pedimento/types';
import type { CbamComposition } from '../chassis/cbam/types';
import type { UflpaComposition } from '../chassis/uflpa/types';
import type { DriverPassComposition } from '../chassis/driver-pass/types';

export interface TicketShipmentBlock {
  origin: { country: string; city?: string };
  destination: { country: string; port_code?: string };
  consignee?: string;
  carrier?: string;
  bol_ref?: string;
  importer_name?: string;
}

export interface TicketCustomsBlock {
  hs_classification: HsClassificationResult;
  origin: OriginValidationResult;
  rvc: RvcResult;
  certificate: UsmcaCertification | null;
}

export interface TicketRegulatoryBlock {
  manifest: SubmissionManifest;
  earliest_deadline_iso: string | null;
  agencies_required: AgencyId[];
}

export interface TicketPaperworkBlock {
  composition: PaperworkComposition;
  doc_count: number;
  blocking_issues: string[];
}

export interface TicketDriversBlock {
  manifest: DriverComplianceManifest;
  overall_status: ComplianceStatus;
  blocking_issues: string[];
}

export interface TicketRefundsBlock {
  composition: RefundComposition;
  total_recoverable_usd: number;
  cape_eligible_count: number;
  protest_required_count: number;
  registry_version: string;
}

export interface TicketDrawbackBlock {
  composition: DrawbackComposition;
  total_drawback_recoverable_usd: number;
  manufacturing_count: number;
  unused_count: number;
  rejected_count: number;
  accelerated_payment_eligible: boolean;
  registry_version: string;
}

export interface TicketPedimentoBlock {
  composition: PedimentoComposition;
  clave: string;
  regimen: string;
  total_contribuciones_usd: number;
  fatal_findings_count: number;
  registry_version: string;
}

export interface TicketCbamBlock {
  composition: CbamComposition;
  in_scope_count: number;
  total_embedded_emissions_t_co2: number;
  certificates_required: number;
  estimated_cbam_cost_eur: number;
  registry_version: string;
}

export interface TicketUflpaBlock {
  composition: UflpaComposition;
  risk_level: string;
  rebuttable_presumption_triggered: boolean;
  fatal_findings_count: number;
  registry_version: string;
}

export interface TicketDriverPassBlock {
  composition: DriverPassComposition;
  readiness: string;
  blocking_doc_count: number;
  expiring_soon_doc_count: number;
  registry_version: string;
}

export interface TicketAuditShield {
  prior_disclosure_eligible: boolean;
  '19_USC_1592_basis': string;
}

// Driver-side consumer Crossing records linked back into a fleet
// Ticket. Per the consumer-side brainstorm 2026-05-04 — when a fleet
// trucker submits a personal Crossing record, the corresponding
// Ticket can compose this block so dispatchers see the actual driver
// trip embedded in the broker bundle. Each entry references a row
// in public.crossings via crossing_id.
export interface TicketDriverCrossingEntry {
  crossing_id: string;
  user_id: string;
  port_id: string;
  direction: 'us_to_mx' | 'mx_to_us';
  started_at: string;
  ended_at: string | null;
  status: 'planning' | 'en_route' | 'in_line' | 'crossing' | 'completed' | 'abandoned';
  modules_present: string[];
  cohort_tags: string[];
}

export interface TicketDriverCrossingsBlock {
  entries: TicketDriverCrossingEntry[];
  total_drivers: number;
  total_crossings: number;
}

export interface TicketCalibration {
  classifier_accuracy_30d?: number;
  origin_accuracy_30d?: number;
}

export interface CruzarTicketV1 {
  schema_version: 'v1';
  ticket_id: string;
  issued_at: string;
  issuer: 'Cruzar Insights, Inc.';
  modules_present: Array<'customs' | 'regulatory' | 'paperwork' | 'drivers' | 'refunds' | 'drawback' | 'pedimento' | 'cbam' | 'uflpa' | 'driver_pass' | 'driver_crossings'>;
  shipment: TicketShipmentBlock;
  customs?: TicketCustomsBlock;
  regulatory?: TicketRegulatoryBlock;
  paperwork?: TicketPaperworkBlock;
  drivers?: TicketDriversBlock;
  refunds?: TicketRefundsBlock;
  drawback?: TicketDrawbackBlock;
  pedimento?: TicketPedimentoBlock;
  cbam?: TicketCbamBlock;
  uflpa?: TicketUflpaBlock;
  driver_pass?: TicketDriverPassBlock;
  driver_crossings?: TicketDriverCrossingsBlock;
  audit_shield: TicketAuditShield;
  calibration: TicketCalibration;
  signing_key_id: string;
  verify_url: string;
}

export interface SignedTicket {
  payload_canonical: string;     // canonical JSON string
  payload: CruzarTicketV1;
  content_hash: string;          // SHA-256 hex
  signature_b64: string;
  signing_key_id: string;
}
