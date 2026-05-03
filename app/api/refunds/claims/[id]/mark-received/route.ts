// app/api/refunds/claims/[id]/mark-received/route.ts
// User confirms refund hit their account. Triggers Stripe charge for Cruzar fee (Task 18 wires the actual charge).
// For now: records observed amount + writes to calibration_log.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { recordRefundObserved } from '@/lib/calibration-refunds';
import { calculateCruzarFee } from '@/lib/chassis/refunds/fee-calculator';
import { chargeForRefund } from '@/lib/refunds-billing';

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
  refund_received_amount_usd: z.number().min(0).max(100_000_000),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const claimId = Number(id);
  if (!Number.isFinite(claimId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

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

  const { data: existing } = await sb
    .from('refund_claims')
    .select('status')
    .eq('id', claimId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (existing.status !== 'submitted_to_ace' && existing.status !== 'refund_in_transit') {
    return NextResponse.json({ error: 'wrong_status', detail: `cannot mark received from status=${existing.status}` }, { status: 409 });
  }

  const receivedAt = new Date().toISOString();
  const finalFee = calculateCruzarFee(parsed.data.refund_received_amount_usd);

  let billing: Awaited<ReturnType<typeof chargeForRefund>> | null = null;
  try {
    billing = await chargeForRefund(user.id, claimId, parsed.data.refund_received_amount_usd);
  } catch (e) {
    // If Stripe billing throws, still record the refund — the fee is recoverable
    // out-of-band. Surface the error in the response so the UI can warn.
    return NextResponse.json({
      error: 'billing_failed',
      detail: e instanceof Error ? e.message : 'unknown',
      fee_owed_usd: finalFee,
    }, { status: 502 });
  }

  const { data, error } = await sb
    .from('refund_claims')
    .update({
      status: 'refund_received',
      refund_received_amount_usd: parsed.data.refund_received_amount_usd,
      refund_received_at: receivedAt,
      cruzar_fee_usd: billing.fee_usd,
      stripe_charge_id: billing.invoice_id,
      updated_at: receivedAt,
    })
    .eq('id', claimId)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordRefundObserved(claimId, parsed.data.refund_received_amount_usd, receivedAt);

  return NextResponse.json({
    claim: data,
    fee_owed_usd: billing.fee_usd,
    billing_status: billing.status,
    hosted_invoice_url: billing.hosted_invoice_url,
  });
}
