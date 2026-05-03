// lib/chassis/eudamed/composer.ts
// Composes EUDAMED actor-registration JSON + UDI/Device CSV from device data
// captured at cross-border events. Cruzar prepares; OEM compliance team uploads
// to EUDAMED. Same H350722 / DeWalt-frame substrate position — we never submit
// on any party's behalf.

import crypto from 'crypto';
import type {
  EudamedActor,
  EudamedActorRegistrationOutput,
  EudamedComposition,
  EudamedDevice,
  EudamedSubmissionInput,
  EudamedUdiCsvRow,
} from './types';
import {
  getCompetentAuthority,
  getNotifiedBody,
  getRegistryVersion,
  isEuCountry,
  requiredPiFields,
  requiresNotifiedBody,
} from './registry';

function validateActor(actor: EudamedActor): string[] {
  const warnings: string[] = [];
  if (!actor.legal_name?.trim()) warnings.push('legal_name is required');
  if (!actor.contact_email?.includes('@')) warnings.push('contact_email is invalid');
  if (!actor.address?.street) warnings.push('address.street is required');
  if (!actor.address?.country_iso) warnings.push('address.country_iso is required');
  if (!actor.registration_country_iso) warnings.push('registration_country_iso is required');

  // EU AR rule (MDR Article 11): non-EU manufacturers MUST have an EU AR.
  if (actor.role === 'manufacturer' && !isEuCountry(actor.registration_country_iso)) {
    if (!actor.authorized_rep_srn) {
      warnings.push(
        'authorized_rep_srn required: non-EU manufacturers must designate an EU Authorized Representative (MDR Article 11). Cruzar can prepare data but cannot designate an AR on your behalf.',
      );
    }
  }

  // Check competent authority is recognized.
  const ca = getCompetentAuthority(actor.registration_country_iso);
  if (!ca && isEuCountry(actor.registration_country_iso)) {
    warnings.push(`No competent authority on file for ${actor.registration_country_iso}`);
  }

  // SRN format check — country prefix must match registration country.
  if (actor.srn) {
    const expectedPrefix = ca?.srn_prefix ?? actor.registration_country_iso.toUpperCase();
    if (!actor.srn.startsWith(expectedPrefix)) {
      warnings.push(
        `SRN "${actor.srn}" does not begin with expected country prefix "${expectedPrefix}" — verify or refresh actor registration`,
      );
    }
  }

  return warnings;
}

function validateDevice(d: EudamedDevice): { valid: boolean; missing_fields: string[] } {
  const missing: string[] = [];
  if (!d.udi_di?.di_value) missing.push('udi_di.di_value');
  if (!d.udi_di?.brand_name) missing.push('udi_di.brand_name');
  if (!d.udi_di?.model_or_reference_number) missing.push('udi_di.model_or_reference_number');
  if (!d.udi_di?.issuing_agency) missing.push('udi_di.issuing_agency');
  if (!d.gmdn_code) missing.push('gmdn_code');
  if (!d.gmdn_term) missing.push('gmdn_term');
  if (!d.risk_class) missing.push('risk_class');

  // GS1 GTIN validation — 14 digits, mod-10 check digit.
  if (d.udi_di?.issuing_agency === 'GS1' && d.udi_di.di_value) {
    if (!/^\d{14}$/.test(d.udi_di.di_value)) {
      missing.push('udi_di.di_value (GS1 GTIN must be 14 digits)');
    } else {
      // Mod-10 check (GTIN-14 algorithm).
      const digits = d.udi_di.di_value.split('').map(Number);
      const check = digits.pop()!;
      let sum = 0;
      for (let i = 0; i < digits.length; i++) {
        sum += digits[i] * (i % 2 === 0 ? 3 : 1);
      }
      const expected = (10 - (sum % 10)) % 10;
      if (expected !== check) {
        missing.push('udi_di.di_value (GS1 GTIN check-digit invalid)');
      }
    }
  }

  // NB required for non-Class-I (and non-IVD_A) devices.
  if (requiresNotifiedBody(d.risk_class)) {
    if (!d.notified_body_id) {
      missing.push('notified_body_id (required for risk class ' + d.risk_class + ')');
    } else {
      const nb = getNotifiedBody(d.notified_body_id);
      if (!nb) {
        missing.push(
          `notified_body_id "${d.notified_body_id}" not in registry snapshot — verify against NANDO database`,
        );
      }
    }
  }

  // Required UDI-PI fields by risk class.
  const piRequired = requiredPiFields(d.risk_class);
  for (const field of piRequired) {
    const value = (d.udi_pi as Record<string, unknown>)?.[field];
    if (!value) {
      missing.push(`udi_pi.${field} (required for risk class ${d.risk_class})`);
    }
  }

  // CE marking.
  if (d.ce_marking_status === 'unmarked' || d.ce_marking_status === 'expired') {
    missing.push(`ce_marking_status=${d.ce_marking_status} — device cannot be placed on EU market`);
  }

  // Sterile + measuring functions need declaration.
  if (d.is_sterile && d.risk_class === 'I' && !d.notified_body_id) {
    missing.push('Class I sterile device requires notified body for sterilization process (Annex IX)');
  }
  if (d.has_measuring_function && d.risk_class === 'I' && !d.notified_body_id) {
    missing.push('Class I device with measuring function requires notified body involvement (Annex VIII Rule 10)');
  }

  return { valid: missing.length === 0, missing_fields: missing };
}

function composeActorRegistration(actor: EudamedActor): EudamedActorRegistrationOutput {
  const warnings = validateActor(actor);
  return {
    payload: {
      actor_legal_name: actor.legal_name,
      actor_trade_name: actor.trade_name,
      actor_role: actor.role,
      srn: actor.srn,
      registration_country: actor.registration_country_iso,
      vat_or_tax_id: actor.vat_or_tax_id,
      address_line: actor.address?.street ?? '',
      city: actor.address?.city ?? '',
      postal_code: actor.address?.postal_code ?? '',
      country: actor.address?.country_iso ?? actor.registration_country_iso,
      contact_email: actor.contact_email ?? '',
      authorized_rep_srn: actor.authorized_rep_srn,
    },
    is_submission_ready: warnings.length === 0,
    validation_warnings: warnings,
    generated_at: new Date().toISOString(),
  };
}

function composeUdiCsv(
  devices: EudamedDevice[],
  capturedAt: string,
): { csv: string; rows: EudamedUdiCsvRow[] } {
  const rows: EudamedUdiCsvRow[] = devices.map((d) => ({
    udi_di: d.udi_di.di_value ?? '',
    brand_name: d.udi_di.brand_name ?? '',
    model_reference: d.udi_di.model_or_reference_number ?? '',
    gmdn_code: d.gmdn_code ?? '',
    gmdn_term: d.gmdn_term ?? '',
    risk_class: d.risk_class,
    is_sterile: d.is_sterile ? 'yes' : 'no',
    has_measuring_function: d.has_measuring_function ? 'yes' : 'no',
    is_active_implantable: d.is_active_implantable ? 'yes' : 'no',
    notified_body_id: d.notified_body_id ?? '',
    ce_marking_status: d.ce_marking_status,
    manufacturer_catalogue_number: d.manufacturer_catalogue_number ?? '',
    lot_number: d.udi_pi.lot_number ?? '',
    serial_number: d.udi_pi.serial_number ?? '',
    manufacturing_date: d.udi_pi.manufacturing_date ?? '',
    expiry_date: d.udi_pi.expiry_date ?? '',
    software_version: d.udi_pi.software_version ?? '',
    captured_at: capturedAt,
  }));

  const headers = [
    'udi_di',
    'brand_name',
    'model_reference',
    'gmdn_code',
    'gmdn_term',
    'risk_class',
    'is_sterile',
    'has_measuring_function',
    'is_active_implantable',
    'notified_body_id',
    'ce_marking_status',
    'manufacturer_catalogue_number',
    'lot_number',
    'serial_number',
    'manufacturing_date',
    'expiry_date',
    'software_version',
    'captured_at',
  ];

  const escape = (v: string) =>
    v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      headers.map((h) => escape(String((r as unknown as Record<string, unknown>)[h] ?? ''))).join(','),
    );
  }
  return { csv: lines.join('\n') + '\n', rows };
}

export function composeEudamedSubmission(input: EudamedSubmissionInput): EudamedComposition {
  const actor_registration = composeActorRegistration(input.actor);
  const { csv: udi_csv } = composeUdiCsv(input.devices, input.captured_at);
  const udi_csv_signature = crypto.createHash('sha256').update(udi_csv).digest('hex');
  const device_validation = input.devices.map((d) => ({
    udi_di: d.udi_di.di_value,
    ...validateDevice(d),
  }));
  const ready_count = device_validation.filter((d) => d.valid).length;
  return {
    actor_registration,
    udi_csv,
    udi_csv_signature,
    device_validation,
    device_count: input.devices.length,
    ready_count,
    blocked_count: input.devices.length - ready_count,
    composed_at: new Date().toISOString(),
    registry_version: getRegistryVersion(),
  };
}
