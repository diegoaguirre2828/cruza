// lib/chassis/refunds/fee-calculator.ts
// Flat 8% platform fee on refunds processed through Cruzar's filing platform.
// $99 floor on any successful refund. Free if recovery is zero (failed/expired
// filings — same way payment processors don't bill on declined transactions).
// This is a PLATFORM FEE on transaction value, not a contingency fee on outcome.

const PLATFORM_FEE_RATE = 0.08;
const PLATFORM_FEE_FLOOR_USD = 99;

export function calculateCruzarFee(recoveryUsd: number): number {
  if (recoveryUsd <= 0) return 0;
  const raw = recoveryUsd * PLATFORM_FEE_RATE;
  const rounded = Math.round(raw * 100) / 100;
  return Math.max(rounded, PLATFORM_FEE_FLOOR_USD);
}
