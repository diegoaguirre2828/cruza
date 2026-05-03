// lib/chassis/refunds/fee-calculator.ts
// Sliding scale: 5% on first $50K, 3% on $50K-$500K, 1.5% above. $99 floor.
// Free if zero recovery.

export function calculateCruzarFee(recoveryUsd: number): number {
  if (recoveryUsd <= 0) return 0;
  let fee = 0;
  fee += Math.min(recoveryUsd, 50_000) * 0.05;
  fee += Math.min(Math.max(recoveryUsd - 50_000, 0), 450_000) * 0.03;
  fee += Math.max(recoveryUsd - 500_000, 0) * 0.015;
  return Math.max(Math.round(fee * 100) / 100, 99);
}
