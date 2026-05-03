// lib/chassis/refunds/composer.ts
import crypto from 'crypto';
import { Entry, IorProfile, RefundComposition } from './types';
import { classifyEntries } from './ieepa-classifier';
import { separateStacking } from './stacking-separator';
import { computeInterest } from './interest-calculator';
import { routeEntries } from './cliff-tracker';
import { composeCapeCsv } from './cape-composer';
import { validateCapeCsv } from './cape-validator';
import { composeForm19Packet } from './form19-composer';
import { calculateCruzarFee } from './fee-calculator';
import { getIeepaRegistry } from './ieepa-registry';

export async function composeRefund(
  entries: Entry[],
  ior: IorProfile,
  today: Date = new Date(),
): Promise<RefundComposition> {
  const reg = getIeepaRegistry();
  const classifications = classifyEntries(entries);
  const eligibleClassifications = classifications.filter(c => c.is_ieepa_eligible);
  const eligibleEntries = entries.filter(e =>
    eligibleClassifications.some(c => c.entry_number === e.entry_number)
  );

  const ieepaPrincipalByEntry = new Map<string, number>();
  for (const c of eligibleClassifications) {
    ieepaPrincipalByEntry.set(c.entry_number, c.ieepa_principal_usd);
  }

  // Stacking separation for each eligible entry
  for (const entry of eligibleEntries) {
    const principal = ieepaPrincipalByEntry.get(entry.entry_number) ?? 0;
    separateStacking(entry, principal);  // currently informational
  }

  // Routing
  const routings = routeEntries(eligibleEntries, today);
  const capeEligible = routings.filter(r => r.cliff_status === 'cape_eligible');
  const protestRequired = routings.filter(r => r.cliff_status === 'protest_required');
  const pastWindow = routings.filter(r => r.cliff_status === 'past_protest_window');
  const ineligible = routings.filter(r => r.cliff_status === 'ineligible');

  // Interest accrual
  let totalPrincipal = 0;
  let totalInterest = 0;
  const todayIso = today.toISOString();
  for (const e of eligibleEntries) {
    const principal = ieepaPrincipalByEntry.get(e.entry_number) ?? 0;
    totalPrincipal += principal;
    const interest = computeInterest(e.entry_number, principal, e.entry_date, todayIso);
    totalInterest += interest.interest_usd;
  }

  // CAPE CSV (only cape_eligible entries)
  const capeRows = capeEligible.map(r => ({ entry_number: r.entry_number }));
  const { csv: capeCsv } = composeCapeCsv(capeRows);
  const validation = validateCapeCsv(capeCsv);
  const capeCsvSig = crypto.createHash('sha256').update(capeCsv).digest('hex');

  // Form 19 packet (only protest_required entries)
  let form19Pdf: Uint8Array | undefined;
  let form19Sig: string | undefined;
  if (protestRequired.length > 0) {
    form19Pdf = await composeForm19Packet(ior, eligibleEntries, routings, ieepaPrincipalByEntry);
    form19Sig = crypto.createHash('sha256').update(form19Pdf).digest('hex');
  }

  const totalRecoverable = Math.round((totalPrincipal + totalInterest) * 100) / 100;
  const estimatedFee = calculateCruzarFee(totalRecoverable);

  return {
    ior_name: ior.ior_name,
    ior_id_number: ior.ior_id_number,
    filer_code: ior.filer_code,
    total_entries: entries.length,
    cape_eligible_count: capeEligible.length,
    protest_required_count: protestRequired.length,
    past_protest_window_count: pastWindow.length,
    ineligible_count: ineligible.length,
    total_principal_recoverable_usd: Math.round(totalPrincipal * 100) / 100,
    total_interest_recoverable_usd: Math.round(totalInterest * 100) / 100,
    total_recoverable_usd: totalRecoverable,
    estimated_cruzar_fee_usd: estimatedFee,
    cape_csv: capeCsv,
    cape_csv_signature: capeCsvSig,
    form19_packet_pdf: form19Pdf,
    form19_packet_signature: form19Sig,
    validation_errors: validation.errors,
    composed_at: todayIso,
    registry_version: reg.version,
  };
}
