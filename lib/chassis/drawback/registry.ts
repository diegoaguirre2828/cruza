// lib/chassis/drawback/registry.ts — statutory parameters for §1313 drawback
import { DrawbackRegistry } from './types';

const REGISTRY: DrawbackRegistry = {
  version: '2026-05-03',
  refund_rate: 0.99,                  // 19 USC §1313(l) — 99% of duties/taxes/fees
  filing_window_years: 5,             // 19 CFR §190.51 — 5 yrs from import
  accelerated_payment_weeks: 3,
  standard_payment_weeks: 52,
  bond_required_for_accelerated: true,
  statutory_references: {
    manufacturing: '19 USC §1313(a) / §1313(b)',
    unused: '19 USC §1313(j)(1) / §1313(j)(2)',
    rejected: '19 USC §1313(c)',
    tftea_reform: 'TFTEA 2016 — Public Law 114-125 (electronic-only filing post-Feb 2018)',
  },
};

export function getDrawbackRegistry(): DrawbackRegistry {
  return REGISTRY;
}
