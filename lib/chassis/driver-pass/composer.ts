// lib/chassis/driver-pass/composer.ts
import {
  DocFinding,
  DocRequirement,
  DocStatus,
  DriverPassComposition,
  DriverProfile,
  ReadinessLevel,
  TripContext,
} from './types';
import { getDriverPassRegistry } from './registry';

export interface ComposeDriverPassInput {
  driver: DriverProfile;
  trip: TripContext;
  docs: DocRequirement[];
}

export function composeDriverPass(
  input: ComposeDriverPassInput,
  today: Date = new Date(),
): DriverPassComposition {
  const reg = getDriverPassRegistry();
  const findings: DocFinding[] = [];

  // Required-set determined by trip direction + hazmat
  const required = new Set<string>([
    ...(input.trip.destination_country === 'US' ? reg.required_docs_us_entry
        : reg.required_docs_mx_entry),
  ]);
  if (input.trip.hazmat) {
    for (const d of reg.hazmat_extra_docs) required.add(d);
  }

  const docsById = new Map(input.docs.map((d) => [d.doc_id, d]));
  for (const reqId of required) {
    const doc = docsById.get(reqId);
    if (!doc) {
      findings.push({
        doc_id: reqId,
        status: 'missing',
        days_to_expiry: null,
        message_en: `Required document "${reqId}" not provided.`,
        message_es: `Documento requerido "${reqId}" no proporcionado.`,
      });
      continue;
    }
    if (!doc.expiry_date) {
      findings.push({
        doc_id: reqId,
        status: 'valid',
        days_to_expiry: null,
        message_en: `${doc.label_en} on file, no expiry tracked.`,
        message_es: `${doc.label_es} en archivo, sin fecha de vencimiento.`,
      });
      continue;
    }
    const expiry = new Date(doc.expiry_date);
    const daysToExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (24 * 3600 * 1000));
    let status: DocStatus;
    let messageEn: string;
    let messageEs: string;
    if (daysToExpiry < 0) {
      status = 'expired';
      messageEn = `${doc.label_en} EXPIRED ${-daysToExpiry} day(s) ago.`;
      messageEs = `${doc.label_es} VENCIDO hace ${-daysToExpiry} día(s).`;
    } else if (daysToExpiry <= reg.expiring_soon_window_days) {
      status = 'expiring_soon';
      messageEn = `${doc.label_en} expires in ${daysToExpiry} day(s) — renew before next cross.`;
      messageEs = `${doc.label_es} vence en ${daysToExpiry} día(s) — renueva antes del próximo cruce.`;
    } else {
      status = 'valid';
      messageEn = `${doc.label_en} valid (${daysToExpiry} days remaining).`;
      messageEs = `${doc.label_es} válido (${daysToExpiry} días restantes).`;
    }
    findings.push({ doc_id: reqId, status, days_to_expiry: daysToExpiry, message_en: messageEn, message_es: messageEs });
  }

  // Optional docs not in required-set still get scanned — informational
  for (const doc of input.docs) {
    if (required.has(doc.doc_id)) continue;
    if (!doc.expiry_date) continue;
    const expiry = new Date(doc.expiry_date);
    const daysToExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (24 * 3600 * 1000));
    if (daysToExpiry < 0) {
      findings.push({
        doc_id: doc.doc_id,
        status: 'expired',
        days_to_expiry: daysToExpiry,
        message_en: `${doc.label_en} (optional) EXPIRED.`,
        message_es: `${doc.label_es} (opcional) VENCIDO.`,
      });
    } else if (daysToExpiry <= reg.expiring_soon_window_days) {
      findings.push({
        doc_id: doc.doc_id,
        status: 'expiring_soon',
        days_to_expiry: daysToExpiry,
        message_en: `${doc.label_en} (optional) expires in ${daysToExpiry} day(s).`,
        message_es: `${doc.label_es} (opcional) vence en ${daysToExpiry} día(s).`,
      });
    }
  }

  const blocking = findings.filter((f) => f.status === 'expired' || f.status === 'missing').length;
  const expiring = findings.filter((f) => f.status === 'expiring_soon').length;

  let readiness: ReadinessLevel = 'ready';
  if (blocking > 0) readiness = 'blocked';
  else if (expiring > 0) readiness = 'partial';

  const recommended_actions: string[] = [];
  for (const f of findings) {
    if (f.status === 'expired') {
      recommended_actions.push(`Renew "${f.doc_id}" before this trip — expired.`);
    } else if (f.status === 'missing') {
      recommended_actions.push(`Obtain "${f.doc_id}" before this trip — required.`);
    } else if (f.status === 'expiring_soon') {
      recommended_actions.push(`Schedule renewal for "${f.doc_id}" within ${f.days_to_expiry} days.`);
    }
  }

  return {
    driver_legal_name: input.driver.driver_legal_name,
    cdl_number: input.driver.cdl_number,
    trip: input.trip,
    readiness,
    doc_findings: findings,
    blocking_doc_count: blocking,
    expiring_soon_doc_count: expiring,
    recommended_actions,
    pass_payload: {
      pass_type: 'cruzar.driver-pass.v1',
      driver: { name: input.driver.driver_legal_name, cdl: input.driver.cdl_number },
      trip: input.trip,
      composed_at: today.toISOString(),
      docs_summary: findings.map((f) => ({ doc_id: f.doc_id, status: f.status })),
    },
    composed_at: today.toISOString(),
    registry_version: reg.version,
  };
}
