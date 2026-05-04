// app/api/driver-pass/scan/route.ts — Free public driver-readiness scanner.
import { NextRequest, NextResponse } from 'next/server';
import { composeDriverPass } from '@/lib/chassis/driver-pass/composer';
import type { DriverProfile, TripContext, DocRequirement } from '@/lib/chassis/driver-pass/types';
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
  driver?: Partial<DriverProfile>;
  trip?: Partial<TripContext>;
  docs?: Partial<DocRequirement>[];
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limited', retry_after_seconds: 3600 }, { status: 429 });
  }
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.driver?.driver_legal_name || !body.driver?.cdl_number) {
    return NextResponse.json({ error: 'missing_driver_identity' }, { status: 400 });
  }
  if (!body.trip?.destination_country) {
    return NextResponse.json({ error: 'missing_trip_destination' }, { status: 400 });
  }
  const docs = (body.docs ?? []).filter((d): d is DocRequirement =>
    !!d && typeof d.doc_id === 'string',
  );
  if (docs.length === 0) {
    return NextResponse.json({ error: 'need_at_least_one_doc' }, { status: 400 });
  }

  const driver: DriverProfile = {
    driver_legal_name: body.driver.driver_legal_name.toString().slice(0, 200),
    cdl_number: body.driver.cdl_number.toString().slice(0, 30),
    cdl_state: body.driver.cdl_state?.toString().slice(0, 2) || 'TX',
    language: body.driver.language === 'es' ? 'es' : 'en',
    fast_card_number: body.driver.fast_card_number?.toString(),
    sentri_card_number: body.driver.sentri_card_number?.toString(),
  };
  const trip: TripContext = {
    origin_country: body.trip.origin_country === 'US' ? 'US' : 'MX',
    destination_country: body.trip.destination_country === 'US' ? 'US' : 'MX',
    crossing_port_code: body.trip.crossing_port_code?.toString() || '',
    hazmat: !!body.trip.hazmat,
    perishables: !!body.trip.perishables,
    scheduled_eta_iso: body.trip.scheduled_eta_iso?.toString() || new Date().toISOString(),
    ticket_id_ref: body.trip.ticket_id_ref?.toString(),
  };

  const comp = composeDriverPass({ driver, trip, docs });
  return NextResponse.json({
    readiness: comp.readiness,
    blocking_doc_count: comp.blocking_doc_count,
    expiring_soon_doc_count: comp.expiring_soon_doc_count,
    doc_findings: comp.doc_findings,
    recommended_actions: comp.recommended_actions,
    pass_payload: comp.pass_payload,
    registry_version: comp.registry_version,
    cross_module_hints: surfaceCrossModuleHints('from_driver_pass', {
      has_entries: false,
      entry_count: 0,
      has_exports: false,
      has_supply_chain: false,
      has_cbam_goods: false,
      has_eori: false,
      has_mexican_broker: false,
      has_driver: true,
      htsus_codes: [],
      countries_of_origin: [],
      has_chinese_supply: false,
      any_duty_paid: false,
    }),
    universal_scan_url: '/scan',
    cta: 'Sign up to issue Apple Wallet passes + email + SMS reminders to your drivers.',
  });
}
