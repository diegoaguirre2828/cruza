// lib/chassis/drivers/composer.ts
// Orchestrates the 5 driver-side compliance checks + assembles manifest.

import type { DriverComplianceInput, DriverComplianceManifest, ComplianceStatus, CheckType } from './types';
import { checkUsmcaAnnex31A } from './usmca-annex-31a';
import { checkImss } from './imss';
import { checkHos } from './hos-divergence';
import { checkDrugTesting } from './drug-testing';
import { checkDrayageClassification } from './drayage-1099';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

function worstStatus(statuses: ComplianceStatus[]): ComplianceStatus {
  // priority: non_compliant > flagged > inconclusive > compliant
  if (statuses.includes('non_compliant')) return 'non_compliant';
  if (statuses.includes('flagged')) return 'flagged';
  if (statuses.includes('inconclusive')) return 'inconclusive';
  return 'compliant';
}

export function buildDriverComplianceManifest(input: DriverComplianceInput, ticketId: string | null = null): DriverComplianceManifest {
  const usmca = checkUsmcaAnnex31A(input);
  const imss = checkImss(input);
  const hos = checkHos(input);
  const drug = checkDrugTesting(input);
  const drayage = checkDrayageClassification(input);

  const checks: CheckType[] = ['usmca_annex_31a', 'imss', 'hos', 'drug_testing', 'drayage_classification'];
  const overall = worstStatus([usmca.compliant, imss.compliant, hos.compliant, drug.compliant, drayage.compliant]);

  const blocking: string[] = [];
  if (usmca.compliant === 'non_compliant' || usmca.compliant === 'flagged') blocking.push(`USMCA Annex 31-A: ${usmca.reason}`);
  if (imss.compliant === 'non_compliant') blocking.push(`IMSS: ${imss.reason}`);
  if (hos.compliant === 'non_compliant') blocking.push(`HOS: ${hos.reason}`);
  if (drug.compliant === 'non_compliant') blocking.push(`Drug testing: ${drug.reason}`);
  if (drayage.compliant === 'non_compliant') blocking.push(`Drayage classification: ${drayage.reason}`);

  return {
    driver_ref: input.driver.driver_ref,
    shipment_ref: input.shipment_ref,
    checks_run: checks,
    usmca_annex_31a: usmca,
    imss,
    hos,
    drug_testing: drug,
    drayage_classification: drayage,
    overall_status: overall,
    blocking_issues: blocking,
    composed_at_iso: new Date().toISOString(),
    ticket_id: ticketId,
    disclaimer: DISCLAIMER,
  };
}
