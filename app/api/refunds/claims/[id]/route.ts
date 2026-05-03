// app/api/refunds/claims/[id]/route.ts
// GET — fetch single claim + entries.
// PATCH — update IOR profile fields (only on draft).

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

const PatchSchema = z.object({
  ior_name: z.string().min(1).max(200).optional(),
  ior_id_number: z.string().min(1).max(40).optional(),
  filer_code: z.string().max(8).nullable().optional(),
  language: z.enum(['en', 'es']).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const claimId = Number(id);
  if (!Number.isFinite(claimId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: claim, error } = await sb
    .from('refund_claims')
    .select('*')
    .eq('id', claimId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claim) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: entries } = await sb
    .from('refund_claim_entries')
    .select('*')
    .eq('claim_id', claimId)
    .order('entry_date', { ascending: true });

  return NextResponse.json({ claim, entries: entries ?? [] });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const claimId = Number(id);
  if (!Number.isFinite(claimId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
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
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'claim_locked', detail: `cannot edit IOR profile after status=${existing.status}` }, { status: 409 });
  }

  const { data, error } = await sb
    .from('refund_claims')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', claimId)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ claim: data });
}
