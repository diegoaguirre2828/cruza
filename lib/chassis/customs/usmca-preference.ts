// lib/chassis/customs/usmca-preference.ts
// USMCA Article 5.2 — 9 required data elements for certification of origin.

import type { UsmcaCertification } from './types';

export interface CertInput {
  certifier_role: 'IMPORTER' | 'EXPORTER' | 'PRODUCER';
  certifier_name: string;
  certifier_address: string;
  exporter_name: string;
  producer_name: string;
  importer_name: string;
  hs_classification: string;
  origin_criterion: 'A' | 'B' | 'C' | 'D';
  blanket_period?: { start: string; end: string };
}

/**
 * Build a USMCA Article 5.2 9-element certification draft.
 * The 9 elements: certifier role + name + address, exporter, producer, importer,
 * HS classification, origin criterion, blanket period (optional), authorized signature.
 */
export function buildUsmcaCertification(input: CertInput): UsmcaCertification {
  return {
    certifier_role: input.certifier_role,
    certifier_name: input.certifier_name,
    certifier_address: input.certifier_address,
    exporter_name: input.exporter_name,
    producer_name: input.producer_name,
    importer_name: input.importer_name,
    hs_classification: input.hs_classification,
    origin_criterion: input.origin_criterion,
    ...(input.blanket_period ? { blanket_period: input.blanket_period } : {}),
    authorized_signature_required: true,
  };
}

/**
 * Validate that a certification has all 9 required elements populated.
 */
export function validateCertification(cert: UsmcaCertification): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!cert.certifier_role) missing.push('certifier_role');
  if (!cert.certifier_name) missing.push('certifier_name');
  if (!cert.certifier_address) missing.push('certifier_address');
  if (!cert.exporter_name) missing.push('exporter_name');
  if (!cert.producer_name) missing.push('producer_name');
  if (!cert.importer_name) missing.push('importer_name');
  if (!cert.hs_classification) missing.push('hs_classification');
  if (!cert.origin_criterion) missing.push('origin_criterion');
  if (!cert.authorized_signature_required) missing.push('authorized_signature_required');
  return { valid: missing.length === 0, missing };
}
