// lib/chassis/refunds/cape-composer.ts
// Composes the CAPE Declaration CSV. CBP's template requires ONLY entry numbers,
// one per row, with a single header. No additional columns. Up to 9,999 entries
// per Declaration.

import { CapeCsvRow } from './types';

const CAPE_HEADER = 'Entry Number';
const MAX_ENTRIES_PER_DECLARATION = 9999;

export function composeCapeCsv(rows: CapeCsvRow[]): { csv: string; warnings: string[] } {
  const warnings: string[] = [];
  if (rows.length === 0) {
    return { csv: '', warnings: ['No entries to compose'] };
  }
  if (rows.length > MAX_ENTRIES_PER_DECLARATION) {
    warnings.push(`${rows.length} entries exceeds CAPE limit of ${MAX_ENTRIES_PER_DECLARATION} per Declaration. Split into multiple Declarations.`);
  }
  const lines = [CAPE_HEADER, ...rows.slice(0, MAX_ENTRIES_PER_DECLARATION).map(r => r.entry_number)];
  return { csv: lines.join('\n'), warnings };
}
