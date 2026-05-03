// lib/chassis/refunds/ieepa-classifier.ts
import { Entry, IeepaClassification } from './types';
import { findApplicableEo, getDutyRate } from './ieepa-registry';

export function classifyEntry(entry: Entry): IeepaClassification {
  const matchedCodes: string[] = [];
  let applicableEo: string | null = null;
  let ieepaPrincipal = 0;

  for (const code of entry.htsus_codes) {
    if (!code.startsWith('9903.')) continue;
    const eo = findApplicableEo(entry.country_of_origin, entry.entry_date, code);
    if (eo) {
      matchedCodes.push(code);
      applicableEo = eo.eo_number;
      const rate = getDutyRate(eo, entry.country_of_origin);
      ieepaPrincipal += entry.total_dutiable_value_usd * (rate / 100);
    }
  }

  if (matchedCodes.length === 0) {
    return {
      entry_number: entry.entry_number,
      is_ieepa_eligible: false,
      applicable_eo: null,
      ieepa_chapter_99_codes: [],
      ieepa_principal_usd: 0,
      reason: 'No IEEPA Chapter 99 code found on entry within applicable date/country range',
    };
  }

  return {
    entry_number: entry.entry_number,
    is_ieepa_eligible: true,
    applicable_eo: applicableEo,
    ieepa_chapter_99_codes: matchedCodes,
    ieepa_principal_usd: Math.round(ieepaPrincipal * 100) / 100,
    reason: `Matched EO ${applicableEo} via codes ${matchedCodes.join(', ')}`,
  };
}

export function classifyEntries(entries: Entry[]): IeepaClassification[] {
  return entries.map(classifyEntry);
}
