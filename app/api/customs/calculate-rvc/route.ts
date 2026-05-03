import { NextRequest, NextResponse } from 'next/server';
import { calculateRvc } from '@/lib/chassis/customs/rvc-calculator';
import { logChassisCall } from '@/lib/calibration';

export const runtime = 'nodejs';

interface RequestBody {
  transaction_value_usd: number;
  vnm_total_usd: number;
  net_cost_usd?: number;
  threshold_required?: number;
  shipment_ref?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try { body = await req.json() as RequestBody; } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (typeof body.transaction_value_usd !== 'number' || typeof body.vnm_total_usd !== 'number') {
    return NextResponse.json({ error: 'transaction_value_usd and vnm_total_usd required' }, { status: 400 });
  }

  const t0 = Date.now();
  const result = calculateRvc({
    transaction_value_usd: body.transaction_value_usd,
    vnm_total_usd: body.vnm_total_usd,
    net_cost_usd: body.net_cost_usd,
    threshold_required: body.threshold_required,
  });
  await logChassisCall({
    call_type: 'rvc_calculate',
    shipment_ref: body.shipment_ref ?? null,
    ticket_id: null,
    input_payload: { tv: body.transaction_value_usd, nc: body.net_cost_usd, vnm: body.vnm_total_usd, threshold: body.threshold_required },
    output_payload: result,
    confidence: 1.0,
    duration_ms: Date.now() - t0,
    caller: 'api/customs/calculate-rvc',
  });

  return NextResponse.json(result);
}
