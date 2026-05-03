// app/api/refunds/claims/route.ts
// GET — list current user's refund claims.
// POST — create a new draft claim with IOR profile (entries uploaded later via /upload-ace-csv).

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

const CreateSchema = z.object({
  ior_name: z.string().min(1).max(200),
  ior_id_number: z.string().min(1).max(40),
  filer_code: z.string().max(8).optional(),
  language: z.enum(['en', 'es']).default('en'),
});

export async function GET() {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await sb
    .from('refund_claims')
    .select('id, ior_name, ior_id_number, filer_code, total_entries, total_principal_owed_usd, total_interest_owed_usd, cape_eligible_count, protest_required_count, status, language, refund_received_amount_usd, cruzar_fee_usd, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claims: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const { data, error } = await sb
    .from('refund_claims')
    .insert({
      user_id: user.id,
      ior_name: parsed.data.ior_name,
      ior_id_number: parsed.data.ior_id_number,
      filer_code: parsed.data.filer_code ?? null,
      language: parsed.data.language,
      status: 'draft',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ claim: data }, { status: 201 });
}
