import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTicket, canonicalize } from '@/lib/ticket/json-signer';
import type { CruzarTicketV1, SignedTicket } from '@/lib/ticket/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supa
    .from('tickets')
    .select('ticket_id,schema_version,issued_at,modules_present,shipment_ref,importer_name,origin_country,destination_country,port_of_entry,payload_canonical,content_hash,signature_b64,signing_key_id,superseded_by')
    .eq('ticket_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const payload = data.payload_canonical as CruzarTicketV1;
  const signed: SignedTicket = {
    payload_canonical: canonicalize(payload),
    payload,
    content_hash: data.content_hash,
    signature_b64: data.signature_b64,
    signing_key_id: data.signing_key_id,
  };

  const v = await verifyTicket(signed);

  return NextResponse.json({
    signed,
    server_verify: v,
    superseded_by: data.superseded_by,
  });
}
