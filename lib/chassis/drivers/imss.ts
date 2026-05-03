// lib/chassis/drivers/imss.ts
// IMSS (Instituto Mexicano del Seguro Social) contribution status check.
// v1: days-since-last-payment heuristic against broker-supplied driver record.
// v2: direct IMSS web service / API integration.

import type { ImssResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

const LAPSED_30_DAYS = 30;
const LAPSED_60_DAYS = 60;

function daysBetween(a: string, b: string): number {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.floor(ms / (24 * 3600 * 1000));
}

export function checkImss(input: DriverComplianceInput): ImssResult {
  const driver = input.driver;

  if (driver.primary_jurisdiction === 'US' && input.shipment_route === 'US_only') {
    return {
      compliant: 'compliant',
      reason: 'US-only driver on US-only shipment — IMSS not applicable',
      days_since_last_payment: null,
      payment_status: 'not_applicable',
      manifest_notes: [],
    };
  }

  if (driver.imss_active === false) {
    return {
      compliant: 'non_compliant',
      reason: 'Driver IMSS coverage marked inactive — Mexican social-security obligation unmet',
      days_since_last_payment: null,
      payment_status: 'lapsed_60_plus',
      manifest_notes: [
        'Driver must have IMSS coverage for cross-border or MX-only shipments per Mexican Federal Labor Law',
        'Reactivate IMSS via patron registration before driver re-engages on this lane',
        DISCLAIMER,
      ],
    };
  }

  if (driver.imss_active === undefined) {
    return {
      compliant: 'inconclusive',
      reason: 'IMSS coverage status unknown — broker must affirm before clearance',
      days_since_last_payment: null,
      payment_status: 'unknown',
      manifest_notes: [
        'Mark imss_active=true|false in driver record before re-running the check',
        DISCLAIMER,
      ],
    };
  }

  // imss_active === true
  if (!driver.imss_last_payment_iso) {
    return {
      compliant: 'flagged',
      reason: 'IMSS marked active but no last-payment date supplied',
      days_since_last_payment: null,
      payment_status: 'unknown',
      manifest_notes: [
        'Capture last IMSS contribution payment date for on-time-payment verification',
        DISCLAIMER,
      ],
    };
  }

  const daysSince = daysBetween(new Date().toISOString(), driver.imss_last_payment_iso);
  if (daysSince <= LAPSED_30_DAYS) {
    return {
      compliant: 'compliant',
      reason: `Last IMSS payment ${daysSince}d ago — current`,
      days_since_last_payment: daysSince,
      payment_status: 'current',
      manifest_notes: [DISCLAIMER],
    };
  }
  if (daysSince <= LAPSED_60_DAYS) {
    return {
      compliant: 'flagged',
      reason: `Last IMSS payment ${daysSince}d ago — lapsed 30-60d, broker review required`,
      days_since_last_payment: daysSince,
      payment_status: 'lapsed_30',
      manifest_notes: [
        'Confirm next IMSS payment scheduled within 30 days; otherwise driver coverage may lapse mid-shipment',
        DISCLAIMER,
      ],
    };
  }
  return {
    compliant: 'non_compliant',
    reason: `Last IMSS payment ${daysSince}d ago — lapsed >60d, coverage likely terminated`,
    days_since_last_payment: daysSince,
    payment_status: 'lapsed_60_plus',
    manifest_notes: [
      'IMSS coverage almost certainly terminated; reactivate before driver re-engages',
      'Driver injury during shipment with lapsed IMSS = direct broker liability for medical + indemnification per LFT Articles 53/54',
      DISCLAIMER,
    ],
  };
}
