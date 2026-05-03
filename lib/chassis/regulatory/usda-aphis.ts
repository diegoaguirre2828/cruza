// lib/chassis/regulatory/usda-aphis.ts
// USDA APHIS Plant Protection & Quarantine (PPQ) composer.
// PPQ Form 587 = plant inspection; PPQ Form 925 = origin certification.

import type { UsdaAphisComposition, RoutingInput } from './types';

// HS chapters that trigger USDA APHIS:
// 06 = live trees, plants, cut flowers
// 07 = vegetables (USDA inspects + FDA Prior Notice both apply)
// 08 = fruits (same)
// 09 = spices, coffee, tea
// 10 = cereals (grain inspection)
// 12 = oil seeds, miscellaneous grains
// 14 = vegetable plaiting materials
// 44 = wood (treatment/quarantine for forest pests)
const APHIS_CHAPTERS = new Set(['06','07','08','09','10','12','14','44']);

export function composeUsdaAphis(input: RoutingInput): UsdaAphisComposition {
  const chapter = input.hs.hts_10.slice(0, 2);

  if (!APHIS_CHAPTERS.has(chapter)) {
    return {
      required: false,
      reason_required: `HS chapter ${chapter}: outside USDA APHIS PPQ jurisdiction`,
      forms_applicable: [],
      fields: {
        importer: { name: '', address: '' },
        consignee: { name: '', address: '' },
        origin_country: input.shipment.origin_country,
        port_of_entry: input.shipment.port_of_entry ?? '',
        arrival_date_eta_iso: input.arrival_eta_iso,
        species_or_commodity: input.shipment.product_description,
        quantity: { amount: 0, unit: 'EA' },
      },
      manifest_notes: [],
    };
  }

  // Wood (chapter 44) typically requires fumigation/heat treatment
  const treatment = chapter === '44' ? 'heat' : undefined;

  // Forms: 587 always; 925 when origin certification matters (most produce + plant material)
  const forms: Array<'PPQ_587' | 'PPQ_925'> = ['PPQ_587'];
  if (['06','07','08','12','14'].includes(chapter)) forms.push('PPQ_925');

  return {
    required: true,
    reason_required: `HS chapter ${chapter}: USDA APHIS PPQ required pre-clearance`,
    forms_applicable: forms,
    fields: {
      importer: { name: input.shipment.importer_name ?? 'TBD', address: 'TBD' },
      consignee: { name: 'TBD', address: 'TBD' },
      origin_country: input.shipment.origin_country,
      port_of_entry: input.shipment.port_of_entry ?? 'TBD',
      arrival_date_eta_iso: input.arrival_eta_iso,
      species_or_commodity: input.shipment.product_description,
      quantity: { amount: 1, unit: 'EA' },
      treatment_required: treatment,
    },
    manifest_notes: [
      `File ${forms.join(' + ')} via USDA APHIS eFile at efile.aphis.usda.gov`,
      `Schedule pre-arrival inspection at ${input.shipment.port_of_entry ?? 'TBD'} via USDA Field Office`,
      treatment === 'heat' ? `Wood treatment certificate (heat ≥56°C/30min OR fumigation) required at origin per ISPM-15.` : '',
    ].filter(Boolean),
  };
}
