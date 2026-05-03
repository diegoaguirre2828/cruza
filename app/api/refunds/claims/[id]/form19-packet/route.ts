// app/api/refunds/claims/[id]/form19-packet/route.ts
// Stream the Form 19 protest packet PDF back to the user.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const claimId = Number(id);
  if (!Number.isFinite(claimId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: claim } = await sb
    .from('refund_claims')
    .select('form19_packet_url, protest_required_count')
    .eq('id', claimId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!claim.form19_packet_url) {
    if ((claim.protest_required_count ?? 0) === 0) {
      return NextResponse.json({ error: 'no_protest_required', detail: 'No entries in this claim require Form 19 — all are CAPE-eligible.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'no_pdf_yet', detail: 'Upload an ACE CSV first to compose the packet' }, { status: 409 });
  }

  const upstream = await fetch(claim.form19_packet_url);
  if (!upstream.ok) return NextResponse.json({ error: 'blob_fetch_failed' }, { status: 502 });
  const pdf = await upstream.arrayBuffer();

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="form19-protest-packet-${claimId}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
