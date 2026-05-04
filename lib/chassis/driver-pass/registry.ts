// lib/chassis/driver-pass/registry.ts
import { DriverPassRegistry } from './types';

const REGISTRY: DriverPassRegistry = {
  version: '2026-05-04',
  expiring_soon_window_days: 30,
  required_docs_us_entry: [
    'cdl',          // Commercial Driver's License
    'medical',      // DOT medical card (49 CFR § 391.41)
    'twic',         // Transportation Worker Identification Credential (port access)
  ],
  required_docs_mx_entry: [
    'cdl',
    'fmm',          // Forma Migratoria Múltiple (or FMC for commercial)
  ],
  hazmat_extra_docs: ['hazmat_endorsement', 'twic'],
  references: {
    cdl: '49 CFR Part 383',
    twic: '49 CFR § 1572',
    medical: '49 CFR § 391.41',
    fast_sentri: 'CBP Trusted Traveler Programs',
    fmm: 'INM — Forma Migratoria Múltiple',
  },
};

export function getDriverPassRegistry(): DriverPassRegistry {
  return REGISTRY;
}
