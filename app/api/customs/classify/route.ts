import { NextRequest, NextResponse } from 'next/server';
import { classifyHs } from '@/lib/chassis/customs/hs-classifier';
import { logChassisCall } from '@/lib/calibration';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { product_description?: string; declared_hs10?: string; shipment_ref?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.product_description) return NextResponse.json({ error: 'product_description required' }, { status: 400 });

  const t0 = Date.now();
  const result = classifyHs({ product_description: body.product_description, declared_hs10: body.declared_hs10 });
  await logChassisCall({
    call_type: 'hs_classify',
    shipment_ref: body.shipment_ref ?? null,
    ticket_id: null,
    input_payload: { product_description: body.product_description, declared_hs10: body.declared_hs10 },
    output_payload: result,
    confidence: result.confidence,
    duration_ms: Date.now() - t0,
    caller: 'api/customs/classify',
  });

  return NextResponse.json(result);
}
