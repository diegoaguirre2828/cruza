// lib/chassis/customs/rvc-calculator.ts
// USMCA RVC math — Transaction Value + Net Cost methods.
// Net Cost excludes sales promotion, royalties, and shipping from the denominator.

import type { RvcResult } from './types';

interface RvcInput {
  transaction_value_usd: number;
  vnm_total_usd: number;            // value of non-originating materials
  net_cost_usd?: number;
  threshold_required?: number;       // default 60; 75 for autos
}

export function calculateRvc(input: RvcInput): RvcResult {
  const threshold = input.threshold_required ?? 60;
  const tv = input.transaction_value_usd;
  const vnm = input.vnm_total_usd;
  const nc = (input.net_cost_usd != null && input.net_cost_usd > 0) ? input.net_cost_usd : null;

  const tvPct = tv > 0 ? +(((tv - vnm) / tv) * 100).toFixed(2) : null;
  const ncPct = nc != null ? +(((nc - vnm) / nc) * 100).toFixed(2) : null;

  let recommended: 'tv' | 'nc' | 'either' = 'tv';
  if (tvPct != null && ncPct != null) {
    recommended = tvPct >= ncPct ? 'tv' : 'nc';
  } else if (ncPct != null) {
    recommended = 'nc';
  }

  const candidates: number[] = [];
  if (tvPct != null) candidates.push(tvPct);
  if (ncPct != null) candidates.push(ncPct);
  const bestPct = candidates.length > 0 ? Math.max(...candidates) : -Infinity;
  const thresholdMet = bestPct >= threshold;

  return {
    transaction_value_pct: tvPct,
    net_cost_pct: ncPct,
    recommended_method: recommended,
    threshold_required: threshold,
    threshold_met: thresholdMet,
    vnm_total_usd: vnm,
    supporting_doc_manifest: [
      'BOM with per-component values + origin (5 yr retention)',
      'Supplier certifications of origin for non-originating materials',
      'Production cost ledger (NC method) — retain 5 yrs USMCA',
      'Transaction value documentation (commercial invoices, payment terms)',
    ],
  };
}
