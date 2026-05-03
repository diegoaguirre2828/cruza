// app/api/refunds/claims/[id]/mark-submitted/route.ts
// User confirms they submitted the CAPE CSV (and any Form 19 packet) to CBP/ACE.
// Optionally captures the CAPE claim number CBP returns.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

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

const Schema = z.object({
  cape_claim_number: z.string().min(1).max(40).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const claimId = Number(id);
  if (!Number.isFinite(claimId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body OK */ }
  const parsed = Schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const { data: existing } = await sb
    .from('refund_claims')
    .select('status')
    .eq('id', claimId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (existing.status !== 'validated' && existing.status !== 'submitted_to_ace') {
    return NextResponse.json({ error: 'wrong_status', detail: `cannot mark submitted from status=${existing.status}` }, { status: 409 });
  }

  const { data, error } = await sb
    .from('refund_claims')
    .update({
      status: 'submitted_to_ace',
      cape_claim_number: parsed.data.cape_claim_number ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ claim: data });
}
