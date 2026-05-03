// lib/chassis/refunds/interest-calculator.ts
// CBP pays the quarterly overpayment rate per 19 CFR 24.3a, compounded daily,
// from duty payment date through refund issuance date.

import { InterestCalculation } from './types';
import { getIeepaRegistry } from './ieepa-registry';

function quarterKey(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeInterest(
  entryNumber: string,
  principalUsd: number,
  paidAt: string,
  computedThrough: string,
): InterestCalculation {
  const reg = getIeepaRegistry();
  const rates = reg.interest_rate_table_19_cfr_24_3a;
  const start = new Date(paidAt);
  const end = new Date(computedThrough);

  const ratePeriods: { quarter: string; rate_pct: number; days: number }[] = [];
  let cursor = new Date(start);
  let balance = principalUsd;

  while (cursor < end) {
    const qKey = quarterKey(cursor);
    const rate = rates[qKey] ?? 7.5;  // fallback rate
    const nextQuarterStart = new Date(Date.UTC(
      cursor.getUTCFullYear(),
      (Math.floor(cursor.getUTCMonth() / 3) + 1) * 3,
      1,
    ));
    const periodEnd = nextQuarterStart < end ? nextQuarterStart : end;
    const days = daysBetween(cursor, periodEnd);
    if (days <= 0) { cursor = nextQuarterStart; continue; }
    const dailyRate = rate / 100 / 365;
    balance *= Math.pow(1 + dailyRate, days);
    ratePeriods.push({ quarter: qKey, rate_pct: rate, days });
    cursor = periodEnd;
  }

  const interestUsd = Math.round((balance - principalUsd) * 100) / 100;
  return {
    entry_number: entryNumber,
    principal_usd: principalUsd,
    paid_at: paidAt,
    computed_through: computedThrough,
    interest_usd: interestUsd,
    rate_periods: ratePeriods,
  };
}
