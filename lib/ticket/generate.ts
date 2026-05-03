// lib/ticket/generate.ts
// Orchestrates: chassis call -> compose Ticket payload -> sign -> persist -> return.

import { createClient } from '@supabase/supabase-js';
import type { ShipmentInput } from '../chassis/customs/types';
import { classifyHs } from '../chassis/customs/hs-classifier';
import { validateOrigin } from '../chassis/customs/origin-validator';
import { calculateRvc } from '../chassis/customs/rvc-calculator';
import { signTicket } from './json-signer';
import { logChassisCall } from '../calibration';
import { buildSubmissionManifest } from '../chassis/regulatory/submitter';
import { composePaperwork } from '../chassis/docs/composer';
import type { VisionInput } from '../chassis/docs/types';
import { buildDriverComplianceManifest } from '../chassis/drivers/composer';
import type { DriverComplianceInput } from '../chassis/drivers/types';
import type { CruzarTicketV1, SignedTicket, TicketRegulatoryBlock, TicketPaperworkBlock, TicketDriversBlock } from './types';

interface GenerateOptions {
  shipment: ShipmentInput;
  caller?: string;
  created_by_user_id?: string | null;
  regulatoryInput?: {
    arrival_eta_iso: string;
    vessel_load_iso?: string;
    mode_of_transport: 'truck' | 'ocean' | 'air' | 'rail';
  };
  paperworkInput?: {
    pages: VisionInput[];
  };
  driversInput?: DriverComplianceInput;
}

function mintTicketId(): string {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}_${String(d.getUTCMonth() + 1).padStart(2, '0')}_${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `cr_${stamp}_${rand}`;
}

export async function generateTicket(opts: GenerateOptions): Promise<{ signed: SignedTicket; persisted: boolean; error?: string }> {
  const { shipment, caller = 'lib/ticket/generate', created_by_user_id = null } = opts;

  // 1. Run chassis + log each call
  const t0 = Date.now();
  const hs = classifyHs({ product_description: shipment.product_description, declared_hs10: shipment.declared_hs10 });
  await logChassisCall({
    call_type: 'hs_classify',
    shipment_ref: shipment.shipment_ref ?? null,
    ticket_id: null,
    input_payload: { product_description: shipment.product_description },
    output_payload: hs,
    confidence: hs.confidence,
    duration_ms: Date.now() - t0,
    caller,
  });

  const productChapter = hs.hts_10.slice(0, 2);
  const t1 = Date.now();
  const origin = validateOrigin(shipment, productChapter);
  await logChassisCall({
    call_type: 'origin_validate',
    shipment_ref: shipment.shipment_ref ?? null,
    ticket_id: null,
    input_payload: { product_chapter: productChapter, bom: shipment.bom },
    output_payload: origin,
    confidence: origin.confidence,
    duration_ms: Date.now() - t1,
    caller,
  });

  const vnm = shipment.bom.filter(b => !['US','MX','CA'].includes(b.origin_country)).reduce((s, b) => s + b.value_usd, 0);
  const t2 = Date.now();
  const rvc = calculateRvc({
    transaction_value_usd: shipment.transaction_value_usd,
    vnm_total_usd: vnm,
    net_cost_usd: shipment.net_cost_usd,
  });
  await logChassisCall({
    call_type: 'rvc_calculate',
    shipment_ref: shipment.shipment_ref ?? null,
    ticket_id: null,
    input_payload: { tv: shipment.transaction_value_usd, nc: shipment.net_cost_usd, vnm },
    output_payload: rvc,
    confidence: 1.0,
    duration_ms: Date.now() - t2,
    caller,
  });

  // Module 3: regulatory manifest (optional — only when broker provides ETA + mode)
  const regulatoryBlock: TicketRegulatoryBlock | null = opts.regulatoryInput
    ? (() => {
        const manifest = buildSubmissionManifest({
          shipment,
          hs,
          origin,
          rvc,
          arrival_eta_iso: opts.regulatoryInput.arrival_eta_iso,
          vessel_load_iso: opts.regulatoryInput.vessel_load_iso,
          mode_of_transport: opts.regulatoryInput.mode_of_transport,
        }, null);
        return {
          manifest,
          earliest_deadline_iso: manifest.earliest_deadline_iso,
          agencies_required: manifest.agencies_required,
        };
      })()
    : null;

  // Module 4: paperwork composition (optional — only when broker provides image bytes)
  let paperworkBlock: TicketPaperworkBlock | null = null;
  if (opts.paperworkInput && opts.paperworkInput.pages.length > 0) {
    const { composition } = await composePaperwork({ pages: opts.paperworkInput.pages });
    paperworkBlock = {
      composition,
      doc_count: composition.doc_count,
      blocking_issues: composition.blocking_issues,
    };
  }

  // Module 5: drivers compliance manifest (optional — only when broker provides driver input)
  let driversBlock: TicketDriversBlock | null = null;
  if (opts.driversInput) {
    const manifest = buildDriverComplianceManifest(opts.driversInput, null);
    driversBlock = {
      manifest,
      overall_status: manifest.overall_status,
      blocking_issues: manifest.blocking_issues,
    };
  }

  // 2. Compose payload
  const ticketId = mintTicketId();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cruzar.app';
  const shipmentBlock: CruzarTicketV1['shipment'] = {
    origin: { country: shipment.origin_country },
    destination: shipment.port_of_entry
      ? { country: shipment.destination_country, port_code: shipment.port_of_entry }
      : { country: shipment.destination_country },
  };
  if (shipment.importer_name) shipmentBlock.importer_name = shipment.importer_name;
  if (shipment.bol_ref) shipmentBlock.bol_ref = shipment.bol_ref;

  const modulesPresent: Array<'customs' | 'regulatory' | 'paperwork' | 'drivers'> = ['customs'];
  if (regulatoryBlock) modulesPresent.push('regulatory');
  if (paperworkBlock) modulesPresent.push('paperwork');
  if (driversBlock) modulesPresent.push('drivers');

  const payload: CruzarTicketV1 = {
    schema_version: 'v1',
    ticket_id: ticketId,
    issued_at: new Date().toISOString(),
    issuer: 'Cruzar Insights, Inc.',
    modules_present: modulesPresent,
    shipment: shipmentBlock,
    customs: {
      hs_classification: hs,
      origin,
      rvc,
      certificate: origin.certificate_origin_draft,
    },
    regulatory: regulatoryBlock ?? undefined,
    paperwork: paperworkBlock ?? undefined,
    drivers: driversBlock ?? undefined,
    audit_shield: {
      prior_disclosure_eligible: true,
      '19_USC_1592_basis': 'Negligence threshold met if violation surfaces post-clearance; Ticket serves as contemporaneous record per 19 CFR § 162.74.',
    },
    calibration: {},
    signing_key_id: process.env.CRUZAR_TICKET_KEY_ID ?? 'k1-unset',
    verify_url: `${baseUrl}/ticket/${ticketId}`,
  };

  // 3. Sign (async)
  const signed = await signTicket(payload);

  // 4. Persist
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const insertRow: Record<string, unknown> = {
    ticket_id: ticketId,
    schema_version: 'v1',
    issued_at: payload.issued_at,
    modules_present: payload.modules_present,
    shipment_ref: shipment.shipment_ref,
    importer_name: shipment.importer_name,
    origin_country: shipment.origin_country,
    destination_country: shipment.destination_country,
    port_of_entry: shipment.port_of_entry,
    payload_canonical: JSON.parse(signed.payload_canonical),
    content_hash: signed.content_hash,
    signature_b64: signed.signature_b64,
    signing_key_id: signed.signing_key_id,
    created_via: caller,
  };
  if (created_by_user_id) insertRow.created_by_user_id = created_by_user_id;
  const { error } = await supa.from('tickets').insert(insertRow);

  return {
    signed,
    persisted: !error,
    ...(error ? { error: error.message } : {}),
  };
}
