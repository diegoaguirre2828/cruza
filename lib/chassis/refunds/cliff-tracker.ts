// lib/chassis/refunds/cliff-tracker.ts
// Routes entries to one of:
//   cape_eligible — unliquidated OR liquidated within 80 days (CAPE Phase 1)
//   protest_required — liquidated 81-180 days ago (Form 19 protest path)
//   past_protest_window — liquidated > 180 days ago (refund right may be extinguished)
//   ineligible — AD/CVD pending, drawback-flagged, reconciliation-flagged, etc.

import { Entry, CliffRouting, CliffStatus } from './types';

function daysSince(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  return Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function routeEntry(entry: Entry, today: Date = new Date()): CliffRouting {
  let cliffStatus: CliffStatus = 'cape_eligible';
  let daysSinceLiq: number | null = null;
  let protestDeadline: string | null = null;
  let reason = '';

  // Ineligible categories first
  if (entry.liquidation_status === 'extended' || entry.liquidation_status === 'suspended') {
    cliffStatus = 'ineligible';
    reason = `Liquidation status '${entry.liquidation_status}' — refund issued at liquidation in ordinary course`;
  } else if (entry.liquidation_status === 'unliquidated') {
    cliffStatus = 'cape_eligible';
    reason = 'Unliquidated entry — eligible for CAPE Phase 1';
  } else if (entry.liquidation_date) {
    daysSinceLiq = daysSince(entry.liquidation_date, today);
    protestDeadline = addDays(entry.liquidation_date, 180);
    if (daysSinceLiq <= 80) {
      cliffStatus = 'cape_eligible';
      reason = `Liquidated ${daysSinceLiq} days ago — within 80-day CAPE Phase 1 cliff`;
    } else if (daysSinceLiq <= 180) {
      cliffStatus = 'protest_required';
      reason = `Liquidated ${daysSinceLiq} days ago — past 80-day CAPE cliff, file Form 19 protest by ${protestDeadline}`;
    } else {
      cliffStatus = 'past_protest_window';
      reason = `Liquidated ${daysSinceLiq} days ago — past 180-day protest window. Recovery requires CIT lawsuit or future CAPE Phase 2`;
    }
  } else {
    cliffStatus = 'cape_eligible';
    reason = 'No liquidation date — treated as unliquidated';
  }

  return {
    entry_number: entry.entry_number,
    cliff_status: cliffStatus,
    days_since_liquidation: daysSinceLiq,
    protest_deadline: protestDeadline,
    reason,
  };
}

export function routeEntries(entries: Entry[], today: Date = new Date()): CliffRouting[] {
  return entries.map(e => routeEntry(e, today));
}
