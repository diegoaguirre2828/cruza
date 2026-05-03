// app/api/refunds/claims/[id]/cape-csv/route.ts
// Stream the composed CAPE CSV back to the user as a download.

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
    .select('cape_csv_url, status')
    .eq('id', claimId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!claim.cape_csv_url) {
    return NextResponse.json({ error: 'no_csv_yet', detail: 'Upload an ACE CSV first to compose the CAPE declaration' }, { status: 409 });
  }

  const upstream = await fetch(claim.cape_csv_url);
  if (!upstream.ok) return NextResponse.json({ error: 'blob_fetch_failed' }, { status: 502 });
  const csv = await upstream.text();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="cape-declaration-${claimId}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
