// lib/chassis/drivers/drug-testing.ts
// DOT 49 CFR Part 40 + MX equivalency mapper.
// Annual test currency + jurisdiction-match flag.
// Equivalency table format adopted from Canadian Bill C-46 + provincial frameworks (structural pattern only).

import type { DrugTestingResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

const TEST_CURRENT_DAYS = 365;
const TEST_EXPIRING_SOON_DAYS = 335;

function daysBetween(a: string, b: string): number {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.floor(ms / (24 * 3600 * 1000));
}

export function checkDrugTesting(input: DriverComplianceInput): DrugTestingResult {
  const driver = input.driver;

  if (!driver.last_drug_test_iso) {
    return {
      compliant: 'inconclusive',
      reason: 'No drug-test date on file — required for any commercial driver per 49 CFR Part 40',
      days_since_last_test: null,
      test_currency: 'unknown',
      jurisdiction_match: false,
      equivalency_required: false,
      manifest_notes: [
        'Capture last_drug_test_iso + last_drug_test_jurisdiction in driver record',
        DISCLAIMER,
      ],
    };
  }

  const daysSince = daysBetween(new Date().toISOString(), driver.last_drug_test_iso);
  let testCurrency: DrugTestingResult['test_currency'];
  if (daysSince > TEST_CURRENT_DAYS) testCurrency = 'expired';
  else if (daysSince > TEST_EXPIRING_SOON_DAYS) testCurrency = 'expiring_soon';
  else testCurrency = 'current';

  const tested = driver.last_drug_test_jurisdiction ?? 'US_DOT';
  const route = input.shipment_route;
  let jurisdictionMatch = false;
  let equivalencyRequired = false;

  if (route === 'US_only') {
    jurisdictionMatch = tested === 'US_DOT' || tested === 'BOTH';
    equivalencyRequired = !jurisdictionMatch;
  } else if (route === 'MX_only') {
    jurisdictionMatch = tested === 'MX_SCT' || tested === 'BOTH';
    equivalencyRequired = !jurisdictionMatch;
  } else {
    jurisdictionMatch = tested === 'BOTH';
    equivalencyRequired = !jurisdictionMatch;
  }

  let compliant: DrugTestingResult['compliant'];
  let reason: string;
  const notes: string[] = [];

  if (testCurrency === 'expired') {
    compliant = 'non_compliant';
    reason = `Drug test expired ${daysSince - TEST_CURRENT_DAYS}d ago — annual renewal required before driver re-engages`;
    notes.push('Schedule DOT 5-panel + alcohol screen via SAP-certified collection facility before next shipment');
  } else if (testCurrency === 'expiring_soon') {
    compliant = 'flagged';
    reason = `Drug test current but expires in ${TEST_CURRENT_DAYS - daysSince}d — schedule renewal`;
    notes.push('Schedule annual DOT renewal in next 30 days');
  } else if (equivalencyRequired) {
    compliant = 'flagged';
    reason = route === 'cross_border'
      ? `Test current but jurisdiction is ${tested} only — cross-border shipment requires both US DOT + MX SCT panels`
      : `Test jurisdiction (${tested}) does not match shipment route (${route}) — equivalency mapping required`;
    notes.push('NOM-035-STPS-2018 (MX) and 49 CFR Part 40 (US) overlap on cocaine/opioid/amphetamine panels but differ on cannabis (US Schedule I, MX recently decriminalized) and alcohol thresholds');
    // Structural equivalency table (per-substance mapping) — pattern adopted from Canadian Bill C-46
    notes.push('Equivalency table per substance:');
    notes.push('  cocaine: US-DOT Part 40 OK / MX NOM-035-STPS-2018 OK (equivalent)');
    notes.push('  opioids: US-DOT Part 40 OK / MX NOM-035-STPS-2018 OK (equivalent)');
    notes.push('  amphetamine/methamphetamine: US-DOT Part 40 OK / MX NOM-035-STPS-2018 OK (equivalent)');
    notes.push('  PCP: US-DOT Part 40 OK / MX NOM-035-STPS-2018 X (US-only)');
    notes.push('  cannabis (THC): US-DOT Part 40 OK / MX NOM-035-STPS-2018 partial (different cutoff post-2021 MX reform)');
    notes.push('  alcohol: US-DOT 0.04% BAC / MX 0.04% BAC commercial (equivalent thresholds)');
    notes.push('Recommend cross-jurisdiction certified collection or supplemental panel before re-engagement');
  } else {
    compliant = 'compliant';
    reason = `Drug test current (${daysSince}d ago, ${tested} jurisdiction matches ${route} route)`;
  }

  notes.push(DISCLAIMER);

  return {
    compliant,
    reason,
    days_since_last_test: daysSince,
    test_currency: testCurrency,
    jurisdiction_match: jurisdictionMatch,
    equivalency_required: equivalencyRequired,
    manifest_notes: notes,
  };
}
