// lib/chassis/refunds/stacking-separator.ts
// Rule I05: when an entry line has IEEPA + Section 232 + Section 301 stacked,
// only the IEEPA portion is refundable. CBP CAPE rejects declarations that
// don't separate properly. We must split deterministically.

import { Entry, StackingSplit } from './types';

const SECTION_232_PREFIXES = ['9903.80.', '9903.81.', '9903.85.', '9903.86.'];
const SECTION_301_PREFIXES = ['9903.88.'];

function isSection232(htsCode: string): boolean {
  return SECTION_232_PREFIXES.some(p => htsCode.startsWith(p));
}

function isSection301(htsCode: string): boolean {
  return SECTION_301_PREFIXES.some(p => htsCode.startsWith(p));
}

function isIeepaCode(htsCode: string): boolean {
  return htsCode.startsWith('9903.01.') || htsCode.startsWith('9903.02.');
}

export function separateStacking(entry: Entry, ieepaPrincipalUsd: number): StackingSplit {
  let section232 = 0;
  let section301 = 0;
  let unrelatedDuty = 0;

  for (const line of entry.duty_lines) {
    if (isIeepaCode(line.htsus_code)) continue;
    if (isSection232(line.htsus_code)) section232 += line.amount_usd;
    else if (isSection301(line.htsus_code)) section301 += line.amount_usd;
    else if (!line.is_chapter_99) unrelatedDuty += line.amount_usd;
  }

  return {
    entry_number: entry.entry_number,
    ieepa_portion_usd: Math.round(ieepaPrincipalUsd * 100) / 100,
    section_232_portion_usd: Math.round(section232 * 100) / 100,
    section_301_portion_usd: Math.round(section301 * 100) / 100,
    unrelated_duty_usd: Math.round(unrelatedDuty * 100) / 100,
  };
}
