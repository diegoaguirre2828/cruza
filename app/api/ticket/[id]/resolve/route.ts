import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortHealth } from '@/lib/portHealth';
import { PORT_META } from '@/lib/portMeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supa
    .from('tickets')
    .select('ticket_id,schema_version,issued_at,modules_present,shipment_ref,port_of_entry,payload_canonical,linked_products')
    .eq('ticket_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const portId = data.port_of_entry as string | null;
  let port_context: Record<string, unknown> | null = null;

  if (portId && PORT_META[portId]) {
    const meta = PORT_META[portId];
    const health = await getPortHealth(portId);
    port_context = {
      port_id: portId,
      port_name: meta.localName ?? meta.city,
      mega_region: meta.megaRegion,
      lat: meta.lat,
      lng: meta.lng,
      health_score: health.score,
      typical_wait_min: health.medianWait,
      p75_wait_min: health.p75Wait,
      trend: health.trend,
      last_reading: health.lastReading,
    };
  }

  return NextResponse.json({
    ticket_id: data.ticket_id,
    schema_version: data.schema_version,
    issued_at: data.issued_at,
    modules_present: data.modules_present,
    shipment_ref: data.shipment_ref,
    port_of_entry: portId,
    port_context,
    linked_products: data.linked_products ?? {},
  });
}
