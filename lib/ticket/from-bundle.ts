// lib/ticket/from-bundle.ts
// Compose a signed Cruzar Ticket directly from a ShipmentBundle + a pre-computed
// MultiModuleComposition. Skips re-running the chassis composers (the orchestrator
// already did that). Skips the customs / regulatory / paperwork / drivers blocks
// since those need rich shipment-level inputs the bundle doesn't carry — those
// fire only when a broker uses lib/ticket/generate.ts directly with a ShipmentInput.
//
// This is the paywall primitive: paid users hit /api/scan with compose_ticket=true,
// the orchestrator runs, then this function signs + persists + returns ticket_id.

import { createClient } from '@supabase/supabase-js';
import { signTicket } from './json-signer';
import type { ShipmentBundle } from '../chassis/shared/shipment-bundle';
import type { MultiModuleComposition } from '../chassis/orchestrator';
import type {
  CruzarTicketV1,
  SignedTicket,
  TicketRefundsBlock,
  TicketDrawbackBlock,
  TicketPedimentoBlock,
  TicketCbamBlock,
  TicketUflpaBlock,
  TicketDriverPassBlock,
} from './types';

function mintTicketId(): string {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}_${String(d.getUTCMonth() + 1).padStart(2, '0')}_${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `cr_${stamp}_${rand}`;
}

export interface BundleTicketResult {
  signed: SignedTicket;
  persisted: boolean;
  error?: string;
  ticket_id: string;
}

export async function generateTicketFromBundle(
  bundle: ShipmentBundle,
  composition: MultiModuleComposition,
  user_id: string,
  caller: string = 'lib/ticket/from-bundle',
): Promise<BundleTicketResult> {
  // Build per-module Ticket blocks from the orchestrator output. Each block is
  // populated only when its module fired during orchestration.

  const refundsBlock: TicketRefundsBlock | undefined = composition.refunds
    ? {
        composition: composition.refunds,
        total_recoverable_usd: composition.refunds.total_recoverable_usd,
        cape_eligible_count: composition.refunds.cape_eligible_count,
        protest_required_count: composition.refunds.protest_required_count,
        registry_version: composition.refunds.registry_version,
      }
    : undefined;

  const drawbackBlock: TicketDrawbackBlock | undefined = composition.drawback
    ? {
        composition: composition.drawback,
        total_drawback_recoverable_usd: composition.drawback.total_drawback_recoverable_usd,
        manufacturing_count: composition.drawback.manufacturing_count,
        unused_count: composition.drawback.unused_count,
        rejected_count: composition.drawback.rejected_count,
        accelerated_payment_eligible: composition.drawback.accelerated_payment_eligible,
        registry_version: composition.drawback.registry_version,
      }
    : undefined;

  const pedimentoBlock: TicketPedimentoBlock | undefined = composition.pedimento
    ? {
        composition: composition.pedimento,
        clave: composition.pedimento.clave,
        regimen: composition.pedimento.regimen,
        total_contribuciones_usd: composition.pedimento.impuestos.total_contribuciones_usd,
        fatal_findings_count: composition.pedimento.findings.filter((f) => f.severity === 'fatal').length,
        registry_version: composition.pedimento.registry_version,
      }
    : undefined;

  const cbamBlock: TicketCbamBlock | undefined = composition.cbam
    ? {
        composition: composition.cbam,
        in_scope_count: composition.cbam.in_scope_count,
        total_embedded_emissions_t_co2: composition.cbam.total_embedded_emissions_t_co2,
        certificates_required: composition.cbam.certificates_required,
        estimated_cbam_cost_eur: composition.cbam.estimated_cbam_cost_eur,
        registry_version: composition.cbam.registry_version,
      }
    : undefined;

  const uflpaBlock: TicketUflpaBlock | undefined = composition.uflpa
    ? {
        composition: composition.uflpa,
        risk_level: composition.uflpa.risk_level,
        rebuttable_presumption_triggered: composition.uflpa.rebuttable_presumption_triggered,
        fatal_findings_count: composition.uflpa.findings.filter((f) => f.severity === 'fatal').length,
        registry_version: composition.uflpa.registry_version,
      }
    : undefined;

  const driverPassBlock: TicketDriverPassBlock | undefined = composition.driver_pass
    ? {
        composition: composition.driver_pass,
        readiness: composition.driver_pass.readiness,
        blocking_doc_count: composition.driver_pass.blocking_doc_count,
        expiring_soon_doc_count: composition.driver_pass.expiring_soon_doc_count,
        registry_version: composition.driver_pass.registry_version,
      }
    : undefined;

  const ticketId = mintTicketId();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cruzar.app';

  // Map shipment-level identifiers from the bundle. The bundle carries enough
  // context to reconstruct a ShipmentBlock without re-running customs.
  const firstEntry = bundle.entries?.[0];
  const firstExport = bundle.exports?.[0];
  const originCountry =
    firstEntry?.country_of_origin ??
    bundle.exporter?.domicilio_fiscal_estado?.slice(0, 2) ??
    bundle.importer.domicilio_fiscal_estado?.slice(0, 2) ??
    'US';
  const destCountry = firstExport?.destination_country ?? bundle.trip?.destination_country ?? 'US';

  const modulesPresent = composition.modules_fired;

  const payload: CruzarTicketV1 = {
    schema_version: 'v1',
    ticket_id: ticketId,
    issued_at: new Date().toISOString(),
    issuer: 'Cruzar Insights, Inc.',
    modules_present: modulesPresent as CruzarTicketV1['modules_present'],
    shipment: {
      origin: { country: originCountry },
      destination: { country: destCountry, ...(bundle.trip?.crossing_port_code ? { port_code: bundle.trip.crossing_port_code } : {}) },
      ...(bundle.importer.legal_name ? { importer_name: bundle.importer.legal_name } : {}),
    },
    refunds: refundsBlock,
    drawback: drawbackBlock,
    pedimento: pedimentoBlock,
    cbam: cbamBlock,
    uflpa: uflpaBlock,
    driver_pass: driverPassBlock,
    audit_shield: {
      prior_disclosure_eligible: true,
      '19_USC_1592_basis':
        'Negligence threshold met if violation surfaces post-clearance; Ticket serves as contemporaneous record per 19 CFR § 162.74. Composed via /api/scan orchestrator from a ShipmentBundle.',
    },
    calibration: {},
    signing_key_id: process.env.CRUZAR_TICKET_KEY_ID ?? 'k1-unset',
    verify_url: `${baseUrl}/ticket/${ticketId}`,
  };

  const signed = await signTicket(payload);

  // Persist
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supa.from('tickets').insert({
    ticket_id: ticketId,
    schema_version: 'v1',
    issued_at: payload.issued_at,
    modules_present: modulesPresent,
    shipment_ref: bundle.bundle_id,
    importer_name: bundle.importer.legal_name,
    origin_country: originCountry,
    destination_country: destCountry,
    port_of_entry: bundle.trip?.crossing_port_code ?? null,
    payload_canonical: JSON.parse(signed.payload_canonical),
    content_hash: signed.content_hash,
    signature_b64: signed.signature_b64,
    signing_key_id: signed.signing_key_id,
    created_via: caller,
    created_by_user_id: user_id,
  });

  return {
    signed,
    persisted: !error,
    ...(error ? { error: error.message } : {}),
    ticket_id: ticketId,
  };
}
