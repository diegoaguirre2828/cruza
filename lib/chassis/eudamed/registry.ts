// lib/chassis/eudamed/registry.ts
// EUDAMED reference data: notified-body whitelist, EU competent-authority list,
// and risk-class → required-NB-involvement mapping.
// Source: EU Commission NANDO database for Notified Bodies (4-digit codes).
// Source: EU MDR Annex VIII for risk-class rules.
// Snapshot: 2026-05 — refresh from NANDO before EUDAMED submissions.

import type { DeviceRiskClass } from './types';

interface NotifiedBody {
  id: string;            // 4-digit NANDO ID
  name: string;
  country_iso: string;
  scope: 'mdr' | 'ivdr' | 'both';
}

interface CompetentAuthority {
  country_iso: string;
  name: string;
  srn_prefix: string;    // e.g., "DE", "FR" — used as SRN country prefix.
}

const REGISTRY_VERSION = 'v1.0.0-2026-05-03';

// Subset of major NBs across EU. Full list is dynamic — refresh from NANDO
// before any EUDAMED submission.
const NOTIFIED_BODIES: NotifiedBody[] = [
  { id: '0123', name: 'TUV SUD Product Service GmbH', country_iso: 'DE', scope: 'both' },
  { id: '0344', name: 'DEKRA Certification GmbH', country_iso: 'DE', scope: 'both' },
  { id: '0459', name: 'GMED', country_iso: 'FR', scope: 'both' },
  { id: '0482', name: 'Medcert GmbH', country_iso: 'DE', scope: 'mdr' },
  { id: '0494', name: 'Eurofins Electric & Electronics Finland Oy', country_iso: 'FI', scope: 'mdr' },
  { id: '0535', name: 'IMQ Istituto Italiano del Marchio di Qualita SpA', country_iso: 'IT', scope: 'mdr' },
  { id: '0546', name: 'CertX AG', country_iso: 'CH', scope: 'mdr' },
  { id: '0598', name: 'SLG Pruef- und Zertifizierungs GmbH', country_iso: 'DE', scope: 'mdr' },
  { id: '0633', name: 'BSI Group The Netherlands BV', country_iso: 'NL', scope: 'both' },
  { id: '0843', name: 'Inspecta Sertifiointi Oy', country_iso: 'FI', scope: 'mdr' },
  { id: '0975', name: 'Polish Centre for Testing and Certification', country_iso: 'PL', scope: 'mdr' },
  { id: '1014', name: 'Slovak Office of Standards Metrology', country_iso: 'SK', scope: 'mdr' },
  { id: '1023', name: 'Institute for Testing and Certification', country_iso: 'CZ', scope: 'mdr' },
  { id: '1304', name: 'Centexbel', country_iso: 'BE', scope: 'mdr' },
  { id: '2265', name: 'BSI Assurance UK Ltd', country_iso: 'GB', scope: 'both' },
  { id: '2797', name: 'BSI Assurance UK Ltd', country_iso: 'GB', scope: 'both' },
];

const COMPETENT_AUTHORITIES: CompetentAuthority[] = [
  { country_iso: 'AT', name: 'Bundesamt für Sicherheit im Gesundheitswesen (BASG)', srn_prefix: 'AT' },
  { country_iso: 'BE', name: 'Federal Agency for Medicines and Health Products (FAMHP)', srn_prefix: 'BE' },
  { country_iso: 'BG', name: 'Bulgarian Drug Agency', srn_prefix: 'BG' },
  { country_iso: 'HR', name: 'Agency for Medicinal Products and Medical Devices', srn_prefix: 'HR' },
  { country_iso: 'CY', name: 'Pharmaceutical Services', srn_prefix: 'CY' },
  { country_iso: 'CZ', name: 'State Institute for Drug Control (SUKL)', srn_prefix: 'CZ' },
  { country_iso: 'DK', name: 'Danish Medicines Agency', srn_prefix: 'DK' },
  { country_iso: 'EE', name: 'State Agency of Medicines', srn_prefix: 'EE' },
  { country_iso: 'FI', name: 'Finnish Medicines Agency (Fimea)', srn_prefix: 'FI' },
  { country_iso: 'FR', name: 'ANSM', srn_prefix: 'FR' },
  { country_iso: 'DE', name: 'BfArM', srn_prefix: 'DE' },
  { country_iso: 'GR', name: 'EOF', srn_prefix: 'GR' },
  { country_iso: 'HU', name: 'OGYEI', srn_prefix: 'HU' },
  { country_iso: 'IE', name: 'HPRA', srn_prefix: 'IE' },
  { country_iso: 'IT', name: 'Ministero della Salute', srn_prefix: 'IT' },
  { country_iso: 'LV', name: 'State Agency of Medicines', srn_prefix: 'LV' },
  { country_iso: 'LT', name: 'State Health Care Accreditation Agency', srn_prefix: 'LT' },
  { country_iso: 'LU', name: 'Ministere de la Sante', srn_prefix: 'LU' },
  { country_iso: 'MT', name: 'Medicines Authority', srn_prefix: 'MT' },
  { country_iso: 'NL', name: 'IGJ — Inspectie Gezondheidszorg en Jeugd', srn_prefix: 'NL' },
  { country_iso: 'PL', name: 'Office for Registration of Medicinal Products', srn_prefix: 'PL' },
  { country_iso: 'PT', name: 'INFARMED', srn_prefix: 'PT' },
  { country_iso: 'RO', name: 'ANMDMR', srn_prefix: 'RO' },
  { country_iso: 'SK', name: 'State Institute for Drug Control', srn_prefix: 'SK' },
  { country_iso: 'SI', name: 'JAZMP', srn_prefix: 'SI' },
  { country_iso: 'ES', name: 'AEMPS', srn_prefix: 'ES' },
  { country_iso: 'SE', name: 'Swedish Medical Products Agency', srn_prefix: 'SE' },
];

const EU_COUNTRY_ISOS = new Set(COMPETENT_AUTHORITIES.map((c) => c.country_iso));

export function isEuCountry(iso: string): boolean {
  return EU_COUNTRY_ISOS.has(iso.toUpperCase());
}

export function getCompetentAuthority(country_iso: string): CompetentAuthority | null {
  return COMPETENT_AUTHORITIES.find((c) => c.country_iso === country_iso.toUpperCase()) ?? null;
}

export function getNotifiedBody(id: string): NotifiedBody | null {
  return NOTIFIED_BODIES.find((nb) => nb.id === id) ?? null;
}

/** Returns true if the risk class requires a Notified Body certificate per
 *  MDR Annex VIII / IVDR Annex VIII. Class I (non-sterile, non-measuring,
 *  non-reusable-surgical) is self-declared. Everything else needs an NB. */
export function requiresNotifiedBody(risk_class: DeviceRiskClass): boolean {
  if (risk_class === 'I' || risk_class === 'IVD_A') return false;
  return true;
}

/** Returns the list of UDI-PI fields required for this risk class.
 *  EUDAMED has graduated requirements — Class III + AIMD require lot OR serial,
 *  others recommend but accept absence. */
export function requiredPiFields(risk_class: DeviceRiskClass): Array<'lot_number' | 'serial_number' | 'manufacturing_date' | 'expiry_date'> {
  if (risk_class === 'III' || risk_class === 'AIMD' || risk_class === 'IVD_D') {
    return ['serial_number', 'expiry_date'];
  }
  if (risk_class === 'IIb' || risk_class === 'IVD_C') {
    return ['lot_number', 'expiry_date'];
  }
  return ['lot_number'];
}

export function getRegistryVersion(): string {
  return REGISTRY_VERSION;
}
