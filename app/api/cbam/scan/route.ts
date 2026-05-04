// app/api/cbam/scan/route.ts — Free CBAM readiness scanner.
import { NextRequest, NextResponse } from 'next/server';
import { composeCbam } from '@/lib/chassis/cbam/composer';
import type { CbamGood, CbamDeclarantProfile } from '@/lib/chassis/cbam/types';
import { surfaceCrossModuleHints } from '@/lib/chassis/shared/cross-module-hints';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_PER_IP_PER_HOUR = 10;
const seenIps = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const slot = seenIps.get(ip);
  if (!slot || slot.resetAt < now) { seenIps.set(ip, { count: 1, resetAt: now + 3600_000 }); return true; }
  if (slot.count >= RATE_LIMIT_PER_IP_PER_HOUR) return false;
  slot.count++;
  return true;
}

interface Body {
  declarant?: Partial<CbamDeclarantProfile>;
  goods?: Partial<CbamGood>[];
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limited', retry_after_seconds: 3600 }, { status: 429 });
  }
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const goods = (body.goods ?? []).filter((g): g is CbamGood =>
    !!g && typeof g.cn_code === 'string' && typeof g.mass_tonnes === 'number',
  );
  if (goods.length === 0) {
    return NextResponse.json({ error: 'need_at_least_one_good' }, { status: 400 });
  }
  if (goods.length > 50) {
    return NextResponse.json({ error: 'too_many_goods', max: 50 }, { status: 400 });
  }

  const declarant: CbamDeclarantProfile = {
    declarant_name: body.declarant?.declarant_name?.toString().slice(0, 200) || 'PUBLIC_SCAN',
    declarant_eori: body.declarant?.declarant_eori?.toString().slice(0, 30) || 'PUBLIC_SCAN',
    authorized_cbam_declarant: !!body.declarant?.authorized_cbam_declarant,
    reporting_period: body.declarant?.reporting_period?.toString().slice(0, 10) || '2026-Q2',
    language: body.declarant?.language === 'es' ? 'es' : 'en',
  };

  const comp = composeCbam({ declarant, goods });
  return NextResponse.json({
    phase: comp.phase,
    in_scope_count: comp.in_scope_count,
    out_of_scope_count: comp.out_of_scope_count,
    total_mass_tonnes: comp.total_mass_tonnes,
    total_embedded_emissions_t_co2: comp.total_embedded_emissions_t_co2,
    total_direct_emissions_t_co2: comp.total_direct_emissions_t_co2,
    total_indirect_emissions_t_co2: comp.total_indirect_emissions_t_co2,
    certificates_required: comp.certificates_required,
    estimated_cbam_cost_eur: comp.estimated_cbam_cost_eur,
    ets_avg_price_eur_per_t: comp.ets_avg_price_eur_per_t,
    findings: comp.findings,
    registry_version: comp.registry_version,
    cross_module_hints: surfaceCrossModuleHints('from_cbam', {
      has_entries: false,
      entry_count: 0,
      has_exports: false,
      has_supply_chain: false,
      has_cbam_goods: goods.length > 0,
      has_eori: !!declarant.declarant_eori && declarant.declarant_eori !== 'PUBLIC_SCAN',
      has_mexican_broker: false,
      has_driver: false,
      htsus_codes: goods.map((g) => g.cn_code),
      countries_of_origin: goods.map((g) => g.installation?.country_iso ?? ''),
      has_chinese_supply: false,
      any_duty_paid: false,
    }),
    universal_scan_url: '/scan',
    cta: 'Sign up to compose your CBAM quarterly report + verifier engagement.',
  });
}
