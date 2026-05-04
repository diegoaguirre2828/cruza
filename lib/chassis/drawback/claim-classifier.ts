// lib/chassis/drawback/claim-classifier.ts
// Given an Entry + Export pair, classifies the drawback claim type per 19 USC §1313.
//
// Heuristic for direct vs substitution:
//   - 10-digit HTSUS exact match  → direct identification (same statistical reporting number)
//   - 8-digit subheading match    → substitution (TFTEA-2016 interchangeability test)
//   - no 8-digit match            → still classified as substitution for unused-merch claims
//                                   (rejected/manufacturing fall through to direct/sub
//                                   based on evidence + 10-digit check)
import { DrawbackEntry, DrawbackExport, DrawbackClaimType } from './types';

export function classifyClaim(
  entry: DrawbackEntry,
  exp: DrawbackExport,
): { claim_type: DrawbackClaimType; reason: string } {
  if (exp.rejection_evidence) {
    return {
      claim_type: 'rejected',
      reason: `Rejected merchandise per §1313(c) — ${exp.rejection_evidence} on file`,
    };
  }

  const tenDigitMatch = htsusMatch(entry.htsus_codes, exp.htsus_or_schedule_b, 10);

  if (exp.manufacturing_evidence) {
    if (tenDigitMatch) {
      return {
        claim_type: 'manufacturing_direct',
        reason: `Manufacturing drawback §1313(a) — direct identification (10-digit match), ${exp.manufacturing_evidence}`,
      };
    }
    return {
      claim_type: 'manufacturing_substitution',
      reason: `Manufacturing drawback §1313(b) — substitution, ${exp.manufacturing_evidence}, post-TFTEA 8-digit interchangeability test`,
    };
  }

  if (tenDigitMatch) {
    return {
      claim_type: 'unused_direct',
      reason: `Unused merchandise drawback §1313(j)(1) — direct identification, same 10-digit HTSUS`,
    };
  }
  return {
    claim_type: 'unused_substitution',
    reason: `Unused merchandise drawback §1313(j)(2) — substitution, post-TFTEA 8-digit interchangeability test`,
  };
}

// Compare HTSUS at the requested digit depth.
function htsusMatch(entryCodes: string[], exportCode: string, depth: 8 | 10): boolean {
  if (!exportCode) return false;
  const exportSub = exportCode.replace(/\D/g, '').slice(0, depth);
  if (exportSub.length < depth) return false;
  return entryCodes.some((c) => {
    const entrySub = c.replace(/\D/g, '').slice(0, depth);
    return entrySub.length >= depth && entrySub === exportSub;
  });
}
