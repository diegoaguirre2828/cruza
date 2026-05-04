// lib/chassis/drawback/composer.ts
// Module 7 orchestrator. Given importer profile + entries + exports + designations,
// produces a DrawbackComposition with eligibility, claim-type classification,
// and 99% refund computation per 19 USC §1313.
import {
  DrawbackComposition,
  DrawbackClaimantProfile,
  DrawbackDesignation,
  DrawbackEntry,
  DrawbackExport,
  DrawbackValidationWarning,
} from './types';
import { classifyClaim } from './claim-classifier';
import { checkEligibility } from './eligibility-checker';
import { computeRefund } from './refund-calculator';
import { getDrawbackRegistry } from './registry';
import { calculateCruzarFee } from '../refunds/fee-calculator';

export interface ComposeDrawbackInput {
  claimant: DrawbackClaimantProfile;
  entries: DrawbackEntry[];
  exports: DrawbackExport[];
  /** Optional explicit designation pairs. If omitted, we naively pair entries to exports
   *  by HTSUS subheading match (8-digit) within the 5-yr window. */
  designations?: Array<{ entry_number: string; export_id: string }>;
}

export function composeDrawback(
  input: ComposeDrawbackInput,
  today: Date = new Date(),
): DrawbackComposition {
  const reg = getDrawbackRegistry();
  const warnings: DrawbackValidationWarning[] = [];
  const designations: DrawbackDesignation[] = [];

  const entryMap = new Map(input.entries.map((e) => [e.entry_number, e]));
  const exportMap = new Map(input.exports.map((e) => [e.export_id, e]));

  const pairs = input.designations ?? autoPair(input.entries, input.exports);

  for (const pair of pairs) {
    const entry = entryMap.get(pair.entry_number);
    const exp = exportMap.get(pair.export_id);
    if (!entry) {
      warnings.push({
        rule_id: 'DBK-F-001',
        severity: 'fatal',
        entry_number: pair.entry_number,
        message: `entry ${pair.entry_number} not found in input`,
      });
      continue;
    }
    if (!exp) {
      warnings.push({
        rule_id: 'DBK-F-002',
        severity: 'fatal',
        export_id: pair.export_id,
        message: `export ${pair.export_id} not found in input`,
      });
      continue;
    }

    const elig = checkEligibility(entry, exp, today);
    if (!elig.eligible) {
      designations.push({
        entry_number: entry.entry_number,
        export_id: exp.export_id,
        designated_units: 0,
        claim_type: 'ineligible',
        ineligibility_reason: elig.reason,
        refund_basis_usd: 0,
        reason: elig.detail,
      });
      continue;
    }

    const cls = classifyClaim(entry, exp);
    const refund = computeRefund(entry, exp);
    designations.push({
      entry_number: entry.entry_number,
      export_id: exp.export_id,
      designated_units: refund.designated_units,
      claim_type: cls.claim_type,
      ineligibility_reason: null,
      refund_basis_usd: refund.refund_basis_usd,
      reason: cls.reason,
    });
  }

  const counts = {
    manufacturing: designations.filter((d) =>
      d.claim_type === 'manufacturing_direct' || d.claim_type === 'manufacturing_substitution',
    ).length,
    unused: designations.filter((d) =>
      d.claim_type === 'unused_direct' || d.claim_type === 'unused_substitution',
    ).length,
    rejected: designations.filter((d) => d.claim_type === 'rejected').length,
    ineligible: designations.filter((d) => d.claim_type === 'ineligible').length,
  };

  const eligibleDesigs = designations.filter((d) => d.claim_type !== 'ineligible');
  const totalRefundBasis = eligibleDesigs.reduce((sum, d) => sum + d.refund_basis_usd, 0);
  const totalDrawback = totalRefundBasis * reg.refund_rate;
  const fee = calculateCruzarFee(totalDrawback);
  const acceleratedEligible =
    input.claimant.has_accelerated_payment_privilege &&
    input.claimant.has_drawback_bond &&
    eligibleDesigs.length > 0;

  return {
    claimant_name: input.claimant.claimant_name,
    claimant_id_number: input.claimant.claimant_id_number,
    total_entries: input.entries.length,
    total_exports: input.exports.length,
    total_designations: designations.length,
    manufacturing_count: counts.manufacturing,
    unused_count: counts.unused,
    rejected_count: counts.rejected,
    ineligible_count: counts.ineligible,
    total_refund_basis_usd: round2(totalRefundBasis),
    total_drawback_recoverable_usd: round2(totalDrawback),
    estimated_cruzar_fee_usd: fee,
    accelerated_payment_eligible: acceleratedEligible,
    registry_version: reg.version,
    composed_at: today.toISOString(),
    designations,
    validation_warnings: warnings,
  };
}

function autoPair(
  entries: DrawbackEntry[],
  exports: DrawbackExport[],
): Array<{ entry_number: string; export_id: string }> {
  const pairs: Array<{ entry_number: string; export_id: string }> = [];
  const claimedExports = new Set<string>();
  for (const entry of entries) {
    const entryDate = new Date(entry.entry_date).getTime();
    const candidates = exports
      .filter((e) => !claimedExports.has(e.export_id))
      .filter((e) => new Date(e.export_date).getTime() >= entryDate)
      .sort((a, b) => new Date(a.export_date).getTime() - new Date(b.export_date).getTime());

    const sameSubheading = candidates.find((e) =>
      entry.htsus_codes.some((c) => normalize8(c) === normalize8(e.htsus_or_schedule_b)),
    );
    const chosen = sameSubheading ?? candidates[0];
    if (chosen) {
      pairs.push({ entry_number: entry.entry_number, export_id: chosen.export_id });
      claimedExports.add(chosen.export_id);
    }
  }
  return pairs;
}

function normalize8(code: string): string {
  return code.replace(/\D/g, '').slice(0, 8);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
