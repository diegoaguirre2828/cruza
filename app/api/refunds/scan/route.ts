// app/api/refunds/scan/route.ts
// Free public eligibility scanner — no auth, IP-rate-limited.
// Returns summary only (no CAPE CSV, no Form 19 PDF) — those gated behind signup.

import { NextRequest, NextResponse } from 'next/server';
import { parseAceCsv } from '@/lib/chassis/refunds/ace-parser';
import { composeRefund } from '@/lib/chassis/refunds/composer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_PER_IP_PER_HOUR = 10;
const seenIps = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const slot = seenIps.get(ip);
  if (!slot || slot.resetAt < now) {
    seenIps.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (slot.count >= RATE_LIMIT_PER_IP_PER_HOUR) return false;
  slot.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limited', retry_after_seconds: 3600 }, { status: 429 });
  }
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data required with field "csv"' }, { status: 400 });
  }
  const fd = await req.formData();
  const file = fd.get('csv');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing csv file' }, { status: 400 });
  }
  const csvText = await file.text();
  const { entries, errors: parseErrors } = parseAceCsv(csvText);
  if (parseErrors.length > 0) {
    return NextResponse.json({ error: 'parse_failed', detail: parseErrors }, { status: 400 });
  }
  const comp = await composeRefund(entries, {
    ior_name: 'PUBLIC_SCAN',
    ior_id_number: 'PUBLIC_SCAN',
    language: 'en',
  });
  return NextResponse.json({
    total_entries: comp.total_entries,
    cape_eligible_count: comp.cape_eligible_count,
    protest_required_count: comp.protest_required_count,
    past_protest_window_count: comp.past_protest_window_count,
    ineligible_count: comp.ineligible_count,
    total_principal_recoverable_usd: comp.total_principal_recoverable_usd,
    total_interest_recoverable_usd: comp.total_interest_recoverable_usd,
    total_recoverable_usd: comp.total_recoverable_usd,
    estimated_cruzar_fee_usd: comp.estimated_cruzar_fee_usd,
    estimated_net_to_you_usd: Math.max(comp.total_recoverable_usd - comp.estimated_cruzar_fee_usd, 0),
    registry_version: comp.registry_version,
    cta: 'Sign up to download the CAPE CSV + Form 19 packet and start your refund claim.',
  });
}
