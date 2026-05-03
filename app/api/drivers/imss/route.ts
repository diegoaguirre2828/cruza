import { NextRequest, NextResponse } from 'next/server';
import { checkImss } from '@/lib/chassis/drivers/imss';
import { logDriverCompliance } from '@/lib/calibration-drivers';
import type { DriverComplianceInput } from '@/lib/chassis/drivers/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { input?: DriverComplianceInput };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.input?.driver) return NextResponse.json({ error: 'input.driver required' }, { status: 400 });
  const result = checkImss(body.input);
  await logDriverCompliance({
    ticket_id: null,
    shipment_ref: body.input.shipment_ref ?? null,
    driver_ref: body.input.driver.driver_ref,
    check_type: 'imss',
    input_payload: body.input,
    output_payload: result,
    status: result.compliant,
    caller: 'api/drivers/imss',
  });
  return NextResponse.json(result);
}
