// lib/calibration-regulatory.ts
// Logs Module 3 composed agency submissions to public.regulatory_submissions.
// Service-role only. Non-throwing per the calibration pattern.

import { createClient } from '@supabase/supabase-js';
import type { AgencyId } from './chassis/regulatory/types';

export interface RegulatoryLogEntry {
  agency: AgencyId;
  shipment_ref: string | null;
  ticket_id: string | null;
  composed_payload: unknown;
  pre_arrival_deadline: string | null;
  caller: string;
}

export async function logRegulatoryComposition(entry: RegulatoryLogEntry): Promise<void> {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { error } = await supa.from('regulatory_submissions').insert({
    agency: entry.agency,
    shipment_ref: entry.shipment_ref,
    ticket_id: entry.ticket_id,
    composed_payload: entry.composed_payload,
    pre_arrival_deadline: entry.pre_arrival_deadline,
    filer_status: 'pending',
    caller: entry.caller,
  });
  if (error) {
    console.error('[regulatory] logRegulatoryComposition insert failed:', error.message);
  }
}
