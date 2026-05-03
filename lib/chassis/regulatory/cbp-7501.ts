// lib/chassis/regulatory/cbp-7501.ts
// CBP Form 7501 (Entry Summary) composer.
// Required for every commercial entry — filed within 10 business days of entry.
// Lifts existing lib/customsForms.ts generator + Module 2 chassis output.
// Reference: 19 CFR §142.11; CBP CATAIR Entry Summary record.

import type { Cbp7501Composition, RoutingInput } from './types';

const FILING_BUSINESS_DAYS = 10;

function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function composeCbp7501(input: RoutingInput, entryDateIso?: string): Cbp7501Composition {
  const entryDate = entryDateIso ?? input.arrival_eta_iso;
  const filingDeadline = addBusinessDays(new Date(entryDate), FILING_BUSINESS_DAYS).toISOString();

  // Compute line item from chassis output
  const ftaCriterion = input.origin.usmca_originating ? 'B' : undefined;
  const ftaClaimed: 'USMCA' | 'NONE' = input.origin.usmca_originating ? 'USMCA' : 'NONE';

  // Use effective rate from origin validator (LIGIE may push above MFN)
  const dutyRatePct = input.origin.effective_rate_pct;
  const lineValue = input.shipment.transaction_value_usd;
  const dutyUsd = +(lineValue * dutyRatePct / 100).toFixed(2);
  const ftaSavingsUsd = input.origin.usmca_originating
    ? +(lineValue * input.origin.mfn_rate_pct / 100).toFixed(2)
    : 0;

  return {
    required: true,
    filing_deadline_iso: filingDeadline,
    fields: {
      entry_type: '01',  // consumption (most common)
      importer_of_record: { name: input.shipment.importer_name ?? 'TBD', ein: 'TBD' },
      importer_address: 'TBD',
      port_of_entry_code: input.shipment.port_of_entry ?? 'TBD',
      entry_date_iso: entryDate,
      arrival_date_iso: input.arrival_eta_iso,
      mode_of_transport: input.mode_of_transport,
      bill_of_lading: input.shipment.bol_ref,
      invoice_total_usd: lineValue,
      line_items: [{
        hts_10: input.hs.hts_10,
        description: input.shipment.product_description,
        quantity: 1,
        unit: 'EA',
        value_usd: lineValue,
        duty_rate_pct: dutyRatePct,
        duty_usd: dutyUsd,
        fta_claimed: ftaClaimed,
        fta_criterion: ftaCriterion,
      }],
      invoice_total: lineValue,
      duty_total: dutyUsd,
      fta_savings_usd: ftaSavingsUsd,
    },
    manifest_notes: [
      `File CF-7501 via ABI / ACE within 10 business days (by ${filingDeadline})`,
      `EIN of Importer of Record required before filing — currently TBD`,
      `Surety bond covering entry value $${lineValue.toFixed(2)} required`,
      input.origin.usmca_originating
        ? `USMCA preference claimed (criterion ${ftaCriterion}); 9-element certification of origin required per Article 5.2`
        : `No FTA preference claimed — full duty applies`,
      input.origin.ligie.affected
        ? `LIGIE 2026 surcharge applies on Asian-origin BOM input (${input.origin.ligie.origin_blocked}, ${input.origin.ligie.rate_pct}%)`
        : '',
    ].filter(Boolean),
  };
}
