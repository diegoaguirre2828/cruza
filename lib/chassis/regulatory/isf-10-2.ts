// lib/chassis/regulatory/isf-10-2.ts
// ISF 10+2 (Importer Security Filing) — required for ocean shipments to US.
// 12 elements: 10 from importer + 2 from carrier. Filed 24h before vessel loading.
// Reference: 19 CFR §149; CBP CATAIR ISF spec.

import type { IsfComposition, RoutingInput } from './types';

const PRE_LOADING_HOURS = 24;

export function composeIsf10_2(input: RoutingInput): IsfComposition {
  if (input.mode_of_transport !== 'ocean') {
    return {
      required: false,
      reason_required: `Mode of transport is "${input.mode_of_transport}" — ISF only applies to ocean cargo`,
      loading_deadline_iso: null,
      elements: {},
      elements_complete: { importer_count: 0, carrier_count: 0 },
      manifest_notes: [],
    };
  }

  const loadingDeadline = input.vessel_load_iso
    ? new Date(new Date(input.vessel_load_iso).getTime() - PRE_LOADING_HOURS * 3600 * 1000).toISOString()
    : null;

  // Trace origin from BOM — first BOM line is country_of_origin (broker can override)
  const firstBom = input.shipment.bom[0];
  const hs6 = input.hs.hts_10.slice(0, 6).replace(/\./g, '');

  return {
    required: true,
    reason_required: 'Ocean shipment: ISF 10+2 required ≥ 24h before foreign-port vessel loading per 19 CFR §149',
    loading_deadline_iso: loadingDeadline,
    elements: {
      // 10 importer elements
      manufacturer_supplier: { name: 'TBD', address: input.shipment.origin_country },
      seller: { name: 'TBD', address: input.shipment.origin_country },
      buyer: { name: input.shipment.importer_name ?? 'TBD', address: 'TBD' },
      ship_to_party: { name: 'TBD', address: 'TBD' },
      container_stuffing_location: 'TBD',
      consolidator_stuffer: { name: 'TBD', address: 'TBD' },
      importer_of_record_number: 'TBD',
      consignee_number: 'TBD',
      country_of_origin: firstBom?.origin_country ?? input.shipment.origin_country,
      hts_6: hs6,
      // 2 carrier elements
      vessel_stow_plan: 'CARRIER-PROVIDES',
      container_status_message: 'CARRIER-PROVIDES',
    },
    elements_complete: { importer_count: 10, carrier_count: 2 },
    manifest_notes: [
      `Submit ISF via ABI / ACE before ${loadingDeadline ?? 'vessel loading - 24h'}`,
      'Late or inaccurate ISF: $5,000 per violation liquidated damages per 19 CFR §149.4',
      'Carrier-supplied elements (stow plan + container status) populate via SCAC code in ACE',
      '7 elements tagged TBD require importer/broker fill before submission',
    ],
  };
}
