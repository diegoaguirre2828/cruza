// lib/chassis/drawback/eligibility-checker.ts
// Filters out designations that fall outside the 5-yr filing window or fail
// other statutory eligibility gates per 19 CFR Part 190.
import {
  DrawbackEntry,
  DrawbackExport,
  DrawbackIneligibilityReason,
} from './types';
import { getDrawbackRegistry } from './registry';

export interface EligibilityResult {
  eligible: boolean;
  reason: DrawbackIneligibilityReason | null;
  detail: string;
}

export function checkEligibility(
  entry: DrawbackEntry,
  exp: DrawbackExport,
  today: Date = new Date(),
): EligibilityResult {
  const reg = getDrawbackRegistry();

  if (entry.total_duty_paid_usd + entry.total_taxes_paid_usd + entry.total_fees_paid_usd <= 0) {
    return {
      eligible: false,
      reason: 'duty_paid_zero',
      detail: 'No duty/tax/fee paid on import — nothing to recover',
    };
  }

  const importDate = new Date(entry.entry_date);
  const exportDate = new Date(exp.export_date);
  const yearsSinceImport = (today.getTime() - importDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (yearsSinceImport > reg.filing_window_years) {
    return {
      eligible: false,
      reason: 'past_5yr_window',
      detail: `Import dated ${entry.entry_date} is ${yearsSinceImport.toFixed(1)}yrs old — past ${reg.filing_window_years}yr filing window per 19 CFR §190.51`,
    };
  }

  if (exportDate < importDate) {
    return {
      eligible: false,
      reason: 'no_export_evidence',
      detail: `Export date ${exp.export_date} precedes import date ${entry.entry_date}`,
    };
  }

  if (exp.unit_count <= 0 || entry.unit_count <= 0) {
    return {
      eligible: false,
      reason: 'no_export_evidence',
      detail: `Unit counts missing — entry=${entry.unit_count}, export=${exp.unit_count}`,
    };
  }

  return { eligible: true, reason: null, detail: 'eligible' };
}
