import { NextRequest, NextResponse } from 'next/server';
import { generateTicket } from '@/lib/ticket/generate';
import { renderTicketPdf } from '@/lib/ticket/pdf';
import type { ShipmentInput } from '@/lib/chassis/customs/types';

export const runtime = 'nodejs';

interface RequestBody {
  shipment: ShipmentInput;
  format?: 'json' | 'pdf';
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try { body = await req.json() as RequestBody; } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.shipment?.product_description) {
    return NextResponse.json({ error: 'shipment.product_description required' }, { status: 400 });
  }

  // Auth optional — guests can generate Tickets in v1; tier-gating will be added later.
  const result = await generateTicket({
    shipment: body.shipment,
    caller: 'api/ticket/generate',
    created_by_user_id: null,
  });

  if (!result.persisted) {
    return NextResponse.json({ error: result.error ?? 'persistence failed', signed: result.signed }, { status: 500 });
  }

  if (body.format === 'pdf') {
    const pdf = await renderTicketPdf(result.signed);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cruzar-ticket-${result.signed.payload.ticket_id}.pdf"`,
      },
    });
  }

  return NextResponse.json({
    ticket_id: result.signed.payload.ticket_id,
    signed: result.signed,
    verify_url: result.signed.payload.verify_url,
  });
}
