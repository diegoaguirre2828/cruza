// lib/chassis/regulatory/submitter.ts
// Routes the chassis output to the appropriate agency composers,
// builds a unified SubmissionManifest with the earliest deadline.

import type { SubmissionManifest, RoutingInput, AgencyId } from './types';
import { composeFdaPriorNotice } from './fda-prior-notice';
import { composeUsdaAphis } from './usda-aphis';
import { composeIsf10_2 } from './isf-10-2';
import { composeCbp7501 } from './cbp-7501';

export function buildSubmissionManifest(input: RoutingInput, ticketId: string | null = null): SubmissionManifest {
  const fda = composeFdaPriorNotice(input);
  const usda = composeUsdaAphis(input);
  const isf = composeIsf10_2(input);
  const cbp_7501 = composeCbp7501(input);

  const agencies: AgencyId[] = [];
  if (fda.required) agencies.push('FDA');
  if (usda.required) agencies.push('USDA');
  if (isf.required) agencies.push('CBP_ISF');
  if (cbp_7501.required) agencies.push('CBP_7501');

  // Earliest deadline across all agencies (broker file-by)
  const deadlines = [
    fda.arrival_deadline_iso,
    isf.loading_deadline_iso,
    cbp_7501.filing_deadline_iso,
  ].filter((d): d is string => d !== null);
  const earliest = deadlines.length > 0
    ? deadlines.reduce((a, b) => new Date(a) < new Date(b) ? a : b)
    : null;

  return {
    shipment_ref: input.shipment.shipment_ref ?? null,
    agencies_required: agencies,
    fda: fda.required ? fda : undefined,
    usda: usda.required ? usda : undefined,
    isf: isf.required ? isf : undefined,
    cbp_7501,
    earliest_deadline_iso: earliest,
    composed_at_iso: new Date().toISOString(),
    ticket_id: ticketId,
  };
}
