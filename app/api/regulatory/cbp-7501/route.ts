import { NextRequest, NextResponse } from 'next/server';
import { composeCbp7501 } from '@/lib/chassis/regulatory/cbp-7501';
import { logRegulatoryComposition } from '@/lib/calibration-regulatory';
import type { RoutingInput } from '@/lib/chassis/regulatory/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { input?: RoutingInput; entry_date_iso?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.input) return NextResponse.json({ error: 'input (RoutingInput) required' }, { status: 400 });
  const result = composeCbp7501(body.input, body.entry_date_iso);
  await logRegulatoryComposition({
    agency: 'CBP_7501',
    shipment_ref: body.input.shipment.shipment_ref ?? null,
    ticket_id: null,
    composed_payload: result,
    pre_arrival_deadline: result.filing_deadline_iso,
    caller: 'api/regulatory/cbp-7501',
  });
  return NextResponse.json(result);
}
