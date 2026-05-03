// lib/chassis/drivers/usmca-annex-31a.ts
// USMCA Annex 31-A — Mexican facility labor obligations.
// v1: attestation-based (broker affirms facility compliance certificate is on file).
// v2: STPS data feed integration.

import type { UsmcaAnnex31AResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

export function checkUsmcaAnnex31A(input: DriverComplianceInput): UsmcaAnnex31AResult {
  // Only relevant for shipments touching MX side
  if (input.shipment_route === 'US_only') {
    return {
      compliant: 'compliant',
      reason: 'US-only shipment — USMCA Annex 31-A not applicable to MX facility',
      facility_attestation_present: false,
      collective_bargaining_compliant: true,
      manifest_notes: [],
    };
  }

  const attestation = !!input.facility_attestation_uploaded;
  if (!attestation) {
    return {
      compliant: 'flagged',
      reason: 'No facility attestation on file — USMCA Annex 31-A requires written compliance affirmation',
      facility_attestation_present: false,
      collective_bargaining_compliant: false,
      manifest_notes: [
        'Upload signed facility compliance certificate (collective bargaining + freedom of association per USMCA Annex 31-A)',
        'STPS-recognized union election + CBA filing required by 1 May 2024 reform deadline',
        DISCLAIMER,
      ],
    };
  }

  return {
    compliant: 'compliant',
    reason: 'Facility attestation on file; USMCA Annex 31-A obligations affirmed',
    facility_attestation_present: true,
    collective_bargaining_compliant: true,
    manifest_notes: [
      'Verify attestation date is within 12 months for annual renewal',
      'Cross-check facility name against STPS union registry (manual broker action)',
      DISCLAIMER,
    ],
  };
}
