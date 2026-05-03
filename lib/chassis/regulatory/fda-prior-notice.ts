// lib/chassis/regulatory/fda-prior-notice.ts
// FDA Prior Notice composer. Required 2h pre-arrival for food shipments.
// Reference: 21 CFR §1.276–1.282; FDA PNSI portal.

import type { FdaPriorNoticeComposition, RoutingInput } from './types';
import fdaCodes from '../../../data/regulatory/fda-product-codes.json';

interface FdaCodeMapping {
  mapping: Record<string, { fda_code: string; category: string; fda_required: boolean; note?: string }>;
}
const FDA_TABLE = fdaCodes as FdaCodeMapping;

const PRE_ARRIVAL_HOURS = 2;

export function composeFdaPriorNotice(input: RoutingInput): FdaPriorNoticeComposition {
  const chapter = input.hs.hts_10.slice(0, 2);
  const entry = FDA_TABLE.mapping[chapter];

  if (!entry || !entry.fda_required) {
    return {
      required: false,
      reason_required: entry
        ? `HS chapter ${chapter} (${entry.category}): ${entry.note ?? 'FDA Prior Notice not required'}`
        : `HS chapter ${chapter}: outside FDA Prior Notice jurisdiction (no mapping)`,
      product_code: null,
      arrival_deadline_iso: null,
      fields: {
        submitter: { name: 'NOT-REQUIRED', address: '' },
        importer: { name: 'NOT-REQUIRED', address: '' },
        owner: { name: 'NOT-REQUIRED', address: '' },
        consignee: { name: 'NOT-REQUIRED', address: '' },
        arrival_information: {
          port_of_entry_code: '',
          arrival_date_eta_iso: '',
          mode_of_transport: input.mode_of_transport,
          carrier: '',
        },
        article: {
          product_code: '',
          common_name: '',
          hts_10: input.hs.hts_10,
          country_of_production: input.shipment.origin_country,
          quantity: { amount: 0, unit: 'EA' },
        },
      },
      manifest_notes: [],
    };
  }

  const arrivalDeadline = new Date(new Date(input.arrival_eta_iso).getTime() - PRE_ARRIVAL_HOURS * 3600 * 1000).toISOString();

  return {
    required: true,
    reason_required: `HS chapter ${chapter} (${entry.category}): FDA Prior Notice required ≥ ${PRE_ARRIVAL_HOURS}h pre-arrival per 21 CFR §1.279`,
    product_code: entry.fda_code,
    arrival_deadline_iso: arrivalDeadline,
    fields: {
      submitter: { name: input.shipment.importer_name ?? 'TBD-BROKER', address: 'TBD-BROKER' },
      importer: { name: input.shipment.importer_name ?? 'TBD', address: 'TBD' },
      owner: { name: 'TBD', address: 'TBD' },
      consignee: { name: 'TBD', address: 'TBD' },
      arrival_information: {
        port_of_entry_code: input.shipment.port_of_entry ?? 'TBD',
        arrival_date_eta_iso: input.arrival_eta_iso,
        mode_of_transport: input.mode_of_transport,
        carrier: 'TBD',
      },
      article: {
        product_code: entry.fda_code,
        common_name: input.shipment.product_description,
        hts_10: input.hs.hts_10,
        country_of_production: input.shipment.origin_country,
        quantity: { amount: 1, unit: 'EA' },
      },
    },
    manifest_notes: [
      `File via FDA Prior Notice System Interface (PNSI) at access.fda.gov before ${arrivalDeadline}.`,
      `Confirmation Number must be captured + reported back via /api/regulatory/manifest PATCH for the Cruzar Ticket to lock.`,
      `Required fields tagged TBD-BROKER need broker / importer / consignee details before submission.`,
    ],
  };
}
