// app/api/cron/refund-tracker/route.ts
// Daily — for claims status='submitted_to_ace' submitted 60+ days ago, send reminder email.
// Cron auth: ?secret=CRON_SECRET OR Authorization: Bearer CRON_SECRET (per Cruzar pattern).

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;
  const auth = req.headers.get('authorization');
  if (auth && auth === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = getServiceClient();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await sb
    .from('refund_claims')
    .select('id, user_id, ior_name, total_principal_owed_usd, total_interest_owed_usd, updated_at, language')
    .eq('status', 'submitted_to_ace')
    .lte('updated_at', sixtyDaysAgo)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'Cruzar Refunds <refunds@cruzar.app>';
  let sent = 0;
  let skipped = 0;

  for (const claim of stale ?? []) {
    const { data: profile } = await sb.auth.admin.getUserById(claim.user_id);
    const email = profile?.user?.email;
    if (!email || !apiKey) { skipped++; continue; }
    const isEs = claim.language === 'es';
    const subject = isEs
      ? `¿Ya recibiste tu refund IEEPA? — Reclamo #${claim.id}`
      : `Have you received your IEEPA refund yet? — Claim #${claim.id}`;
    const totalOwed = Number(claim.total_principal_owed_usd ?? 0) + Number(claim.total_interest_owed_usd ?? 0);
    const body = isEs
      ? `Hola,\n\nHan pasado 60+ días desde que enviaste tu reclamo de refund IEEPA #${claim.id} a ACE.\nMonto esperado: $${totalOwed.toFixed(2)}.\n\nSi ya recibiste el refund, márcalo en tu panel: https://cruzar.app/refunds/claims/${claim.id}\n\nCruzar`
      : `Hi,\n\nIt's been 60+ days since you submitted IEEPA refund claim #${claim.id} to ACE.\nExpected amount: $${totalOwed.toFixed(2)}.\n\nIf the refund landed, mark it in your dashboard: https://cruzar.app/refunds/claims/${claim.id}\n\nCruzar`;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to: email, subject, text: body }),
      });
      if (r.ok) sent++; else skipped++;
    } catch { skipped++; }
  }

  return NextResponse.json({ stale_claims: (stale ?? []).length, sent, skipped, at: new Date().toISOString() });
}
