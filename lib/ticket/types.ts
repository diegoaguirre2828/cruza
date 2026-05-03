// lib/ticket/types.ts
import type { HsClassificationResult, OriginValidationResult, RvcResult, UsmcaCertification } from '../chassis/customs/types';
import type { SubmissionManifest, AgencyId } from '../chassis/regulatory/types';
import type { PaperworkComposition } from '../chassis/docs/types';

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

export interface TicketAuditShield {
  prior_disclosure_eligible: boolean;
  '19_USC_1592_basis': string;
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
  modules_present: Array<'customs' | 'regulatory' | 'paperwork' | 'drivers'>;
  shipment: TicketShipmentBlock;
  customs?: TicketCustomsBlock;
  regulatory?: TicketRegulatoryBlock;
  paperwork?: TicketPaperworkBlock;
  // drivers added in later modules
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
