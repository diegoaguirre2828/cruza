// lib/chassis/shared/ace-csv-to-bundle.ts
// Thin wrapper that converts an ACE Entry Summary CSV into a ShipmentBundle.
// Reuses the existing lib/chassis/refunds/ace-parser.ts which understands the
// ACE column-name conventions. Maps the parsed Entry[] into SharedEntry[]
// (the orchestrator-friendly superset), then builds a partial ShipmentBundle
// with importer info caller supplies separately.

import { parseAceCsv } from '../refunds/ace-parser';
import type { ShipmentBundle, SharedEntry, PartyIdentity } from './shipment-bundle';

export interface CsvIngestResult {
  bundle: ShipmentBundle;
  errors: string[];
  entries_parsed: number;
}

export function aceCsvToBundle(
  csvContent: string,
  importer: PartyIdentity,
  bundle_id: string = `BUN-${Date.now()}`,
): CsvIngestResult {
  const { entries, errors } = parseAceCsv(csvContent);

  const sharedEntries: SharedEntry[] = entries.map((e) => ({
    entry_number: e.entry_number,
    entry_date: e.entry_date,
    liquidation_date: e.liquidation_date,
    liquidation_status: e.liquidation_status,
    country_of_origin: e.country_of_origin,
    htsus_codes: e.htsus_codes,
    total_duty_paid_usd: e.total_duty_paid_usd,
    total_taxes_paid_usd: 0,                       // ACE CSV doesn't always carry these — caller can add
    total_fees_paid_usd: 0,                        // same — leave 0 unless explicit
    total_dutiable_value_usd: e.total_dutiable_value_usd,
    duty_lines: e.duty_lines,
    unit_count: 0,                                  // ACE CSV doesn't typically include — drawback won't fire without it
    merchandise_description: '',                    // same — drawback ineligibility on UPC
  }));

  const bundle: ShipmentBundle = {
    bundle_id,
    importer,
    entries: sharedEntries,
    exports: [],
  };

  return { bundle, errors, entries_parsed: sharedEntries.length };
}
