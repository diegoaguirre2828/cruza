// app/api/refunds/ach-onboarding/route.ts
// Tracks the user's progress through the ACE Portal + ACH enrollment prerequisite for receiving CBP refunds.

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
  ace_portal_account_status: z.enum(['not_started', 'pending', 'active']).optional(),
  ach_enrollment_status: z.enum(['not_started', 'pending', 'enrolled']).optional(),
  bank_routing_last4: z.string().regex(/^\d{4}$/).optional(),
  bank_account_last4: z.string().regex(/^\d{4}$/).optional(),
  language: z.enum(['en', 'es']).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET() {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await sb
    .from('ach_onboarding_status')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    onboarding: data ?? {
      user_id: user.id,
      ace_portal_account_status: 'not_started',
      ach_enrollment_status: 'not_started',
      language: 'en',
    },
  });
}

export async function POST(req: NextRequest) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: existing } = await sb
    .from('ach_onboarding_status')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const patch: Record<string, unknown> = { ...parsed.data, updated_at: now };
  if (parsed.data.ace_portal_account_status === 'pending' && (!existing || !existing.ace_portal_account_started_at)) {
    patch.ace_portal_account_started_at = now;
  }
  if (parsed.data.ace_portal_account_status === 'active' && (!existing || !existing.ace_portal_account_active_at)) {
    patch.ace_portal_account_active_at = now;
  }
  if (parsed.data.ach_enrollment_status === 'enrolled' && (!existing || !existing.ach_enrollment_complete_at)) {
    patch.ach_enrollment_complete_at = now;
  }

  if (existing) {
    const { data, error } = await sb
      .from('ach_onboarding_status')
      .update(patch)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ onboarding: data });
  } else {
    const { data, error } = await sb
      .from('ach_onboarding_status')
      .insert({ user_id: user.id, ...patch })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ onboarding: data }, { status: 201 });
  }
}
