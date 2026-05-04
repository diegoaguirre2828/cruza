// app/api/scan/route.ts
// Universal scan endpoint. POST a ShipmentBundle, get a MultiModuleComposition.
// The "they talk" UX — one input, every applicable module fires in parallel.
//
// Same trust model as the per-module scanners (10/IP/hr public rate limit,
// no auth, OFAC SDN screening skipped on PUBLIC_SCAN profiles).

import { NextRequest, NextResponse } from 'next/server';
import { orchestrate } from '@/lib/chassis/orchestrator';
import type { ShipmentBundle } from '@/lib/chassis/shared/shipment-bundle';

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

  let body: ShipmentBundle;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'expected_shipment_bundle' }, { status: 400 });
  }
  if (!body.bundle_id || !body.importer?.legal_name) {
    return NextResponse.json(
      { error: 'missing_required_fields', required: ['bundle_id', 'importer.legal_name'] },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.entries)) body.entries = [];
  if (!Array.isArray(body.exports)) body.exports = [];
  if (body.entries.length > 50 || body.exports.length > 50) {
    return NextResponse.json({ error: 'too_many_records', max_per_side: 50 }, { status: 400 });
  }

  // Public scan: skip OFAC screening (synthetic profile). Real screening fires
  // when the user signs up + claims compositions against their real identity.
  const composition = await orchestrate(body, { skipScreening: true });

  return NextResponse.json({
    ...composition,
    spec_url: 'https://www.cruzar.app/spec/ticket-v1',
    cta: composition.modules_fired.length > 0
      ? 'Sign up to compose a signed Cruzar Ticket from this scan'
      : 'No modules fired — check the bundle includes entries / exports / supply chain / driver / cbam goods',
  });
}
