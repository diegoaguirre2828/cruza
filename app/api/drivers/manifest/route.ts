import { NextRequest, NextResponse } from 'next/server';
import { buildDriverComplianceManifest } from '@/lib/chassis/drivers/composer';
import { logDriverCompliance } from '@/lib/calibration-drivers';
import type { DriverComplianceInput } from '@/lib/chassis/drivers/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { input?: DriverComplianceInput; ticket_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.input?.driver) return NextResponse.json({ error: 'input.driver required' }, { status: 400 });
  const manifest = buildDriverComplianceManifest(body.input, body.ticket_id ?? null);
  await logDriverCompliance({
    ticket_id: manifest.ticket_id,
    shipment_ref: manifest.shipment_ref,
    driver_ref: manifest.driver_ref,
    check_type: 'manifest',
    input_payload: body.input,
    output_payload: manifest,
    status: manifest.overall_status,
    caller: 'api/drivers/manifest',
  });
  return NextResponse.json(manifest);
}
