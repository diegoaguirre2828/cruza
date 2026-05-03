// lib/chassis/drivers/hos-divergence.ts
// Hours-of-Service dual-regime calculator.
// US DOT FMCSA: 49 CFR §395 — 11h driving / 14h on-duty / 60-70h cycle / 30-min break after 8h.
// Mexican SCT: 8h driving / 9h on-duty / 14h continuous rest between shifts.
// "Divergence flag" fires when one regime passes but the other fails.
// cycle_reset_eligible (Canadian-pattern structural enrichment): true when 34h restart would clear US 70h cycle.

import type { HosResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

const US_MAX_DRIVING = 11;
const US_MAX_ON_DUTY = 14;
const US_MAX_8DAY_CYCLE = 70;
const US_BREAK_REQUIRED_AFTER = 8;
const US_RESTART_HOURS = 34;

const MX_MAX_DRIVING = 8;
const MX_MAX_ON_DUTY = 9;
const MX_MIN_REST_BETWEEN = 14;

export function checkHos(input: DriverComplianceInput): HosResult {
  const log = input.hos_log;

  if (!log) {
    return {
      compliant: 'inconclusive',
      reason: 'No HOS log supplied — driver duty/rest data required for compliance check',
      us_dot: { within_11h_driving: false, within_14h_on_duty: false, within_70h_8day_cycle: false, rest_break_required: false, cycle_reset_eligible: false },
      mx_sct: { within_8h_driving: false, within_9h_on_duty: false, within_14h_rest_break_compliance: false },
      divergence_flag: false,
      manifest_notes: [
        'Capture driver HOS log (driving_hours, on_duty_hours, rest_hours_prior, cycle_hours_last_7_or_8_days) and re-run',
        DISCLAIMER,
      ],
    };
  }

  // US DOT checks
  const within11hDriving = log.driving_hours <= US_MAX_DRIVING;
  const within14hOnDuty = log.on_duty_hours <= US_MAX_ON_DUTY;
  const within70h8day = log.cycle_hours_last_7_or_8_days <= US_MAX_8DAY_CYCLE;
  const breakRequired = log.driving_hours > US_BREAK_REQUIRED_AFTER;
  const usClean = within11hDriving && within14hOnDuty && within70h8day;
  // 34h consecutive off-duty restart eligible when cycle is over but driver could clear via reset
  const cycleResetEligible = !within70h8day && log.rest_hours_prior < US_RESTART_HOURS;

  // MX SCT checks
  const within8hDriving = log.driving_hours <= MX_MAX_DRIVING;
  const within9hOnDuty = log.on_duty_hours <= MX_MAX_ON_DUTY;
  const within14hRest = log.rest_hours_prior >= MX_MIN_REST_BETWEEN;
  const mxClean = within8hDriving && within9hOnDuty && within14hRest;

  const divergence = (input.shipment_route !== 'US_only' && input.shipment_route !== 'MX_only')
    ? (usClean !== mxClean)
    : false;

  // Determine status by route
  let compliant: HosResult['compliant'];
  let reason: string;
  const notes: string[] = [];

  if (input.shipment_route === 'US_only') {
    compliant = usClean ? 'compliant' : 'non_compliant';
    reason = usClean
      ? `US DOT HOS clean (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.cycle_hours_last_7_or_8_days}h cycle)`
      : `US DOT HOS violation (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.cycle_hours_last_7_or_8_days}h cycle vs limits 11/14/70)`;
  } else if (input.shipment_route === 'MX_only') {
    compliant = mxClean ? 'compliant' : 'non_compliant';
    reason = mxClean
      ? `MX SCT HOS clean (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.rest_hours_prior}h rest prior)`
      : `MX SCT HOS violation (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.rest_hours_prior}h rest vs limits 8/9/14)`;
  } else {
    if (usClean && mxClean) {
      compliant = 'compliant';
      reason = 'Both US DOT and MX SCT HOS limits satisfied';
    } else if (divergence) {
      compliant = 'flagged';
      reason = usClean
        ? `US DOT clean but MX SCT violation — driver enters MX side over Mexican limits (US 11h vs MX 8h driving cap)`
        : `MX SCT clean but US DOT violation — unusual; review log for accuracy`;
      notes.push('Cross-border shipment must satisfy stricter of the two regimes (typically MX 8h driving cap)');
    } else {
      compliant = 'non_compliant';
      reason = 'Both US DOT and MX SCT HOS limits violated';
    }
  }

  if (breakRequired) {
    notes.push(`Driver exceeded 8h driving (${log.driving_hours}h) — verify 30-min break taken per 49 CFR §395.3(a)(3)(ii)`);
  }
  if (cycleResetEligible) {
    notes.push(`70h/8d cycle exceeded — 34h consecutive off-duty restart per 49 CFR §395.3(c) would clear cycle. Schedule reset before next dispatch.`);
  }
  notes.push(DISCLAIMER);

  return {
    compliant,
    reason,
    us_dot: {
      within_11h_driving: within11hDriving,
      within_14h_on_duty: within14hOnDuty,
      within_70h_8day_cycle: within70h8day,
      rest_break_required: breakRequired,
      cycle_reset_eligible: cycleResetEligible,
    },
    mx_sct: {
      within_8h_driving: within8hDriving,
      within_9h_on_duty: within9hOnDuty,
      within_14h_rest_break_compliance: within14hRest,
    },
    divergence_flag: divergence,
    manifest_notes: notes,
  };
}
