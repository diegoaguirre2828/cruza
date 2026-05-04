// app/api/refunds/scan/route.ts
// Free public eligibility scanner — no auth, IP-rate-limited.
// Returns summary only (no CAPE CSV, no Form 19 PDF) — those gated behind signup.

import { NextRequest, NextResponse } from 'next/server';
import { parseAceCsv } from '@/lib/chassis/refunds/ace-parser';
import { composeRefund } from '@/lib/chassis/refunds/composer';
import { surfaceCrossModuleHints } from '@/lib/chassis/shared/cross-module-hints';

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
  // Public scan uses synthetic profile name "PUBLIC_SCAN" — skip screening
  // since there's no real IOR identity to screen on. The actual screen fires
  // when the user signs up + creates a claim with their real IOR profile.
  const comp = await composeRefund(entries, {
    ior_name: 'PUBLIC_SCAN',
    ior_id_number: 'PUBLIC_SCAN',
    language: 'en',
  }, undefined, { skipScreening: true });
  // Surface cross-module hints — what other modules could fire on these same entries.
  // The "they talk to each other" surface at the per-module response level: even when
  // the broker entered through /refunds/scan instead of /scan, we tell them what else
  // applies and what data they'd need to provide to surface it.
  const allHtsus = entries.flatMap((e) => e.htsus_codes);
  const allCountries = [...new Set(entries.map((e) => e.country_of_origin))];
  const hints = surfaceCrossModuleHints('from_refunds', {
    has_entries: entries.length > 0,
    entry_count: entries.length,
    has_exports: false,
    has_supply_chain: false,
    has_cbam_goods: false,
    has_eori: false,
    has_mexican_broker: false,
    has_driver: false,
    htsus_codes: allHtsus,
    countries_of_origin: allCountries,
    has_chinese_supply: allCountries.includes('CN'),
    any_duty_paid: entries.some((e) => e.total_duty_paid_usd > 0),
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
    cross_module_hints: hints,
    universal_scan_url: '/scan',
    cta: 'Sign up to download the CAPE CSV + Form 19 packet and start your refund claim.',
  });
}
