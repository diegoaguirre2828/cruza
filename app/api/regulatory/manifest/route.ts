import { NextRequest, NextResponse } from 'next/server';
import { buildSubmissionManifest } from '@/lib/chassis/regulatory/submitter';
import { renderRegulatoryPdf } from '@/lib/chassis/regulatory/pdf';
import { logRegulatoryComposition } from '@/lib/calibration-regulatory';
import type { RoutingInput, AgencyId } from '@/lib/chassis/regulatory/types';

export const runtime = 'nodejs';

interface RequestBody {
  input: RoutingInput;
  ticket_id?: string;
  format?: 'json' | 'pdf';
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try { body = await req.json() as RequestBody; } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.input?.shipment) return NextResponse.json({ error: 'input.shipment required' }, { status: 400 });

  const manifest = buildSubmissionManifest(body.input, body.ticket_id ?? null);

  // Log every agency that was composed
  const logEntries: Array<{ agency: AgencyId; deadline: string | null; payload: unknown }> = [];
  if (manifest.fda?.required) logEntries.push({ agency: 'FDA', deadline: manifest.fda.arrival_deadline_iso, payload: manifest.fda });
  if (manifest.usda?.required) logEntries.push({ agency: 'USDA', deadline: null, payload: manifest.usda });
  if (manifest.isf?.required) logEntries.push({ agency: 'CBP_ISF', deadline: manifest.isf.loading_deadline_iso, payload: manifest.isf });
  if (manifest.cbp_7501?.required) logEntries.push({ agency: 'CBP_7501', deadline: manifest.cbp_7501.filing_deadline_iso, payload: manifest.cbp_7501 });

  for (const e of logEntries) {
    await logRegulatoryComposition({
      agency: e.agency,
      shipment_ref: manifest.shipment_ref,
      ticket_id: manifest.ticket_id,
      composed_payload: e.payload,
      pre_arrival_deadline: e.deadline,
      caller: 'api/regulatory/manifest',
    });
  }

  if (body.format === 'pdf') {
    const pdf = await renderRegulatoryPdf(manifest);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cruzar-regulatory-${manifest.shipment_ref ?? 'manifest'}.pdf"`,
      },
    });
  }

  return NextResponse.json(manifest);
}
