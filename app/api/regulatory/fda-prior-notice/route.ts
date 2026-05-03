import { NextRequest, NextResponse } from 'next/server';
import { composeFdaPriorNotice } from '@/lib/chassis/regulatory/fda-prior-notice';
import { logRegulatoryComposition } from '@/lib/calibration-regulatory';
import type { RoutingInput } from '@/lib/chassis/regulatory/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { input?: RoutingInput };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.input) return NextResponse.json({ error: 'input (RoutingInput) required' }, { status: 400 });
  const result = composeFdaPriorNotice(body.input);
  if (result.required) {
    await logRegulatoryComposition({
      agency: 'FDA',
      shipment_ref: body.input.shipment.shipment_ref ?? null,
      ticket_id: null,
      composed_payload: result,
      pre_arrival_deadline: result.arrival_deadline_iso,
      caller: 'api/regulatory/fda-prior-notice',
    });
  }
  return NextResponse.json(result);
}
