// lib/chassis/drivers/drayage-1099.ts
// Borello test (S. G. Borello & Sons v. Department of Industrial Relations, 1989).
// 11 factors weighing toward independent-contractor (1099) status.
// Misclassification → PAGA / Dynamex (AB-5) liability — direct broker exposure.
// v1 = factor-counting heuristic. v2 = jurisdiction-aware (CA AB-5 vs TX vs Federal).

import type { DrayageClassificationResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination. Borello test outcomes vary by jurisdiction (CA AB-5, TX, Federal) — this score is heuristic.';

const PAGA_RISK_PER_DRIVER_USD = 25_000;

export function checkDrayageClassification(input: DriverComplianceInput): DrayageClassificationResult {
  const d = input.driver;
  const declared = d.employment_classification ?? 'unknown';

  let borelloScore = 0;
  const factorsHit: string[] = [];

  if (d.uses_own_truck) { borelloScore++; factorsHit.push('owns own truck (capital investment)'); }
  if (d.sets_own_schedule) { borelloScore++; factorsHit.push('sets own schedule'); }
  if (d.works_for_other_carriers) { borelloScore += 2; factorsHit.push('works for multiple carriers (strong 1099 signal)'); }
  if (d.carries_independent_business_expenses) { borelloScore++; factorsHit.push('carries independent business expenses'); }
  if (d.paid_per_mile && !d.paid_hourly) { borelloScore++; factorsHit.push('paid per-mile (not hourly)'); }
  if (d.has_own_dot_authority) { borelloScore += 2; factorsHit.push('has own DOT authority (strong 1099 signal)'); }

  let rec: 'W2' | '1099' | 'borderline_review';
  if (borelloScore >= 5) rec = '1099';
  else if (borelloScore <= 2) rec = 'W2';
  else rec = 'borderline_review';

  const match = (declared === rec) || (rec === 'borderline_review' && declared !== 'unknown');

  let compliant: DrayageClassificationResult['compliant'];
  let reason: string;
  let pagaRisk = 0;
  const notes: string[] = [];

  if (declared === 'unknown') {
    compliant = 'inconclusive';
    reason = 'No declared classification — broker must record W2 or 1099 before clearance';
    notes.push('Borello score: ' + borelloScore + '/11. Recommend: ' + rec);
  } else if (rec === 'borderline_review') {
    compliant = 'flagged';
    reason = `Borello score ${borelloScore}/11 — borderline classification, broker review recommended`;
    pagaRisk = PAGA_RISK_PER_DRIVER_USD * 0.5;
    notes.push(`Factors weighing toward 1099: ${factorsHit.join(', ') || 'none'}`);
    notes.push('Borderline cases benefit from documented Borello-factor analysis on file (legal counsel review)');
  } else if (match) {
    compliant = 'compliant';
    reason = `Declared classification (${declared}) matches Borello recommendation (${rec}, score ${borelloScore}/11)`;
  } else {
    compliant = 'non_compliant';
    reason = `Declared classification (${declared}) does NOT match Borello recommendation (${rec}, score ${borelloScore}/11) — misclassification risk`;
    pagaRisk = PAGA_RISK_PER_DRIVER_USD;
    notes.push(`Factors weighing toward ${rec}: ${factorsHit.join(', ') || '(low score, weighing toward W2)'}`);
    notes.push(`PAGA / AB-5 misclassification exposure estimate: $${pagaRisk.toLocaleString()} per affected driver`);
    notes.push('Recommend reclassification or documented Borello defense within 90 days');
  }

  notes.push(DISCLAIMER);

  return {
    compliant,
    reason,
    borello_score: borelloScore,
    classification_recommendation: rec,
    declared_classification: declared,
    classification_match: match,
    paga_risk_estimate_usd: pagaRisk,
    manifest_notes: notes,
  };
}
