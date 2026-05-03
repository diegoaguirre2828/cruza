import { createClient } from '@supabase/supabase-js';
import type { CheckType, ComplianceStatus } from './chassis/drivers/types';

export interface DriverLogEntry {
  ticket_id: string | null;
  shipment_ref: string | null;
  driver_ref: string | null;
  check_type: CheckType | 'manifest';
  input_payload: unknown;
  output_payload: unknown;
  status: ComplianceStatus;
  caller: string;
}

export async function logDriverCompliance(entry: DriverLogEntry): Promise<void> {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supa.from('driver_compliance').insert(entry);
  if (error) console.error('[drivers] logDriverCompliance insert failed:', error.message);
}
