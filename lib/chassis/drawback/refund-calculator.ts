// lib/chassis/drawback/refund-calculator.ts
// Computes the §1313(l) 99% refund basis for a designated entry/export pair.
import { DrawbackEntry, DrawbackExport } from './types';
import { getDrawbackRegistry } from './registry';

export interface RefundComputation {
  designated_units: number;
  refund_basis_usd: number;        // pro-rated duty + tax + fee
  drawback_usd: number;             // refund_basis × 0.99
  pro_rata_factor: number;
}

export function computeRefund(
  entry: DrawbackEntry,
  exp: DrawbackExport,
): RefundComputation {
  const reg = getDrawbackRegistry();
  const designatedUnits = Math.min(entry.unit_count, exp.unit_count);
  const proRata = entry.unit_count > 0 ? designatedUnits / entry.unit_count : 0;

  const dutyBasis = entry.total_duty_paid_usd * proRata;
  const taxBasis = entry.total_taxes_paid_usd * proRata;
  const feeBasis = entry.total_fees_paid_usd * proRata;
  const totalBasis = dutyBasis + taxBasis + feeBasis;

  const drawback = totalBasis * reg.refund_rate;

  return {
    designated_units: designatedUnits,
    refund_basis_usd: round2(totalBasis),
    drawback_usd: round2(drawback),
    pro_rata_factor: round4(proRata),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
