import { NextRequest, NextResponse } from 'next/server';
import { validateOrigin } from '@/lib/chassis/customs/origin-validator';
import { logChassisCall } from '@/lib/calibration';
import type { ShipmentInput } from '@/lib/chassis/customs/types';

export const runtime = 'nodejs';

interface RequestBody {
  shipment: ShipmentInput;
  product_hs_chapter: string;
  shipment_ref?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try { body = await req.json() as RequestBody; } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.shipment || !body.product_hs_chapter) {
    return NextResponse.json({ error: 'shipment and product_hs_chapter required' }, { status: 400 });
  }

  const t0 = Date.now();
  const result = validateOrigin(body.shipment, body.product_hs_chapter);
  await logChassisCall({
    call_type: 'origin_validate',
    shipment_ref: body.shipment_ref ?? null,
    ticket_id: null,
    input_payload: { shipment: body.shipment, product_hs_chapter: body.product_hs_chapter },
    output_payload: result,
    confidence: result.confidence,
    duration_ms: Date.now() - t0,
    caller: 'api/customs/validate-origin',
  });

  return NextResponse.json(result);
}
