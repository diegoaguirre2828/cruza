// app/api/uflpa/scan/route.ts — Free UFLPA risk-flag scanner.
import { NextRequest, NextResponse } from 'next/server';
import { evaluateUflpa } from '@/lib/chassis/uflpa/risk-flagger';
import type { UflpaShipmentInput, SupplyChainTier } from '@/lib/chassis/uflpa/types';

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limited', retry_after_seconds: 3600 }, { status: 429 });
  }
  let body: Partial<UflpaShipmentInput>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.htsus_code || !body.supply_chain || !Array.isArray(body.supply_chain)) {
    return NextResponse.json({ error: 'need_htsus_code_and_supply_chain' }, { status: 400 });
  }
  if (body.supply_chain.length > 20) {
    return NextResponse.json({ error: 'too_many_tiers', max: 20 }, { status: 400 });
  }

  const input: UflpaShipmentInput = {
    importer_name: body.importer_name?.toString().slice(0, 200) || 'PUBLIC_SCAN',
    importer_ein: body.importer_ein?.toString().slice(0, 30) || 'PUBLIC_SCAN',
    htsus_code: body.htsus_code.toString().slice(0, 13),
    product_description: body.product_description?.toString().slice(0, 500) || '',
    expected_arrival_iso: body.expected_arrival_iso?.toString() || new Date().toISOString(),
    port_of_entry: body.port_of_entry?.toString() || '',
    declared_value_usd: Number(body.declared_value_usd) || 0,
    supply_chain: body.supply_chain.map((t) => ({
      tier: Number(t.tier) as SupplyChainTier['tier'],
      supplier_name: String(t.supplier_name ?? ''),
      country_iso: String(t.country_iso ?? ''),
      province_or_state: t.province_or_state ? String(t.province_or_state) : undefined,
      facility_name: t.facility_name ? String(t.facility_name) : undefined,
      is_on_uflpa_entity_list: !!t.is_on_uflpa_entity_list,
      produced_in_xinjiang: !!t.produced_in_xinjiang,
      audit_evidence_present: !!t.audit_evidence_present,
      affidavit_present: !!t.affidavit_present,
    })),
    total_supplier_traceability_tiers: Number(body.total_supplier_traceability_tiers) || body.supply_chain.length,
  };

  const r = evaluateUflpa(input);
  return NextResponse.json({
    risk_level: r.risk_level,
    rebuttable_presumption_triggered: r.rebuttable_presumption_triggered,
    high_risk_sectors_detected: r.high_risk_sectors_detected,
    xinjiang_tier: r.xinjiang_tier,
    entity_list_hits: r.entity_list_hits,
    evidence_quality: r.evidence_quality,
    required_actions: r.required_actions,
    findings: r.findings,
    registry_version: r.registry_version,
    cta: 'Sign up to compose the full UFLPA rebuttal package + supplier-affidavit templates.',
  });
}
