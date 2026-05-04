// app/api/drawback/scan/route.ts
// Free public §1313 drawback eligibility scanner — no auth, IP-rate-limited.
// Accepts JSON body with entries[] + exports[] + claimant info; returns the
// composition summary (no Form 7551 yet). Form composer + claims dashboard
// gated behind signup once we have first paid user.

import { NextRequest, NextResponse } from 'next/server';
import { composeDrawback } from '@/lib/chassis/drawback/composer';
import type { DrawbackEntry, DrawbackExport, DrawbackClaimantProfile } from '@/lib/chassis/drawback/types';

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

interface ScanBody {
  claimant?: Partial<DrawbackClaimantProfile>;
  entries?: Partial<DrawbackEntry>[];
  exports?: Partial<DrawbackExport>[];
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limited', retry_after_seconds: 3600 }, { status: 429 });
  }

  let body: ScanBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const entries = (body.entries ?? []).filter((e): e is DrawbackEntry =>
    !!e && typeof e.entry_number === 'string' && typeof e.entry_date === 'string',
  );
  const exports_ = (body.exports ?? []).filter((e): e is DrawbackExport =>
    !!e && typeof e.export_id === 'string' && typeof e.export_date === 'string',
  );
  if (entries.length === 0 || exports_.length === 0) {
    return NextResponse.json(
      { error: 'need_at_least_one_entry_and_one_export' },
      { status: 400 },
    );
  }
  if (entries.length > 50 || exports_.length > 50) {
    return NextResponse.json(
      { error: 'too_many_records', max_per_side: 50 },
      { status: 400 },
    );
  }

  const claimant: DrawbackClaimantProfile = {
    claimant_name: body.claimant?.claimant_name?.toString().slice(0, 200) || 'PUBLIC_SCAN',
    claimant_id_number: body.claimant?.claimant_id_number?.toString().slice(0, 30) || 'PUBLIC_SCAN',
    filer_code: body.claimant?.filer_code?.toString().slice(0, 3),
    language: body.claimant?.language === 'es' ? 'es' : 'en',
    has_accelerated_payment_privilege: !!body.claimant?.has_accelerated_payment_privilege,
    has_drawback_bond: !!body.claimant?.has_drawback_bond,
  };

  const comp = composeDrawback({ claimant, entries, exports: exports_ });

  return NextResponse.json({
    total_entries: comp.total_entries,
    total_exports: comp.total_exports,
    total_designations: comp.total_designations,
    manufacturing_count: comp.manufacturing_count,
    unused_count: comp.unused_count,
    rejected_count: comp.rejected_count,
    ineligible_count: comp.ineligible_count,
    total_refund_basis_usd: comp.total_refund_basis_usd,
    total_drawback_recoverable_usd: comp.total_drawback_recoverable_usd,
    estimated_cruzar_fee_usd: comp.estimated_cruzar_fee_usd,
    estimated_net_to_you_usd: Math.max(
      comp.total_drawback_recoverable_usd - comp.estimated_cruzar_fee_usd,
      0,
    ),
    accelerated_payment_eligible: comp.accelerated_payment_eligible,
    designations: comp.designations.map((d) => ({
      entry_number: d.entry_number,
      export_id: d.export_id,
      claim_type: d.claim_type,
      ineligibility_reason: d.ineligibility_reason,
      refund_basis_usd: d.refund_basis_usd,
      reason: d.reason,
    })),
    registry_version: comp.registry_version,
    cta: 'Sign up to compose Form 7551 + start your drawback claim.',
  });
}
