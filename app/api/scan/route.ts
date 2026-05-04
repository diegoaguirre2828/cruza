// app/api/scan/route.ts
// Universal scan endpoint. POST a ShipmentBundle, get a MultiModuleComposition.
// The "they talk" UX — one input, every applicable module fires in parallel.
//
// Tier-gated paywall:
//   anon / free signup     → returns math (orchestrator output)
//   free authed (auto-row) → math + can compose 1 signed Ticket / month
//   paid (starter/pro/fleet) → math + compose unlimited (within tier quota)
//                              signed Cruzar Tickets persisted to DB
//
// The signed Ticket is the audit-shielded artifact regulators accept; the math
// alone is the wedge. That gate is what makes paid worth paying for.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { orchestrate } from '@/lib/chassis/orchestrator';
import type { ShipmentBundle } from '@/lib/chassis/shared/shipment-bundle';
import { resolveUserTier, type UserTier } from '@/lib/insights/tier';
import { generateTicketFromBundle } from '@/lib/ticket/from-bundle';

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

interface ScanBody extends ShipmentBundle {
  /** Paid-tier-only flag: when true + user is paid, compose+sign+persist a Cruzar Ticket and return its ID. */
  compose_ticket?: boolean;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limited', retry_after_seconds: 3600 }, { status: 429 });
  }

  let body: ScanBody;
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

  // Resolve tier — feeds capability gates + tier-aware response copy.
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await sb.auth.getUser();
  const { tier, capabilities } = await resolveUserTier(sb, user);

  // Public scan: skip OFAC screening (synthetic profile). Real screening fires
  // for paid-tier compose-ticket flow against real IOR identity.
  const composition = await orchestrate(body, { skipScreening: true });

  // Tier-gated Ticket compose
  let ticket_compose_result: { ticket_id?: string; verify_url?: string; persisted: boolean; error?: string } | null = null;
  if (body.compose_ticket && composition.modules_fired.length > 0) {
    if (!user) {
      ticket_compose_result = { persisted: false, error: 'auth_required_to_compose_ticket' };
    } else if (!capabilities.can_compose_ticket) {
      ticket_compose_result = { persisted: false, error: 'tier_does_not_allow_compose' };
    } else {
      try {
        const r = await generateTicketFromBundle(body, composition, user.id, '/api/scan');
        ticket_compose_result = {
          ticket_id: r.ticket_id,
          verify_url: r.signed.payload.verify_url,
          persisted: r.persisted,
          error: r.error,
        };
      } catch (e) {
        ticket_compose_result = { persisted: false, error: e instanceof Error ? e.message : 'compose_failed' };
      }
    }
  }

  return NextResponse.json({
    ...composition,
    spec_url: 'https://www.cruzar.app/spec/ticket-v1',
    user_tier: tier,
    capabilities,
    ticket: ticket_compose_result,
    cta: ctaForTier(tier, composition.modules_fired.length > 0),
  });
}

function ctaForTier(tier: UserTier, modulesFired: boolean): string {
  if (!modulesFired) {
    return 'No modules fired — check the bundle includes entries / exports / supply chain / driver / cbam goods';
  }
  switch (tier) {
    case 'anon':
      return 'Sign up free to save this scan + compose a signed Cruzar Ticket';
    case 'free':
      return 'Compose your free Cruzar Ticket from this scan — or upgrade to Starter for unlimited tickets + filing artifact downloads';
    case 'starter':
    case 'pro':
    case 'fleet':
      return 'Compose a signed Cruzar Ticket — verifiable against the Cruzar public key, regulator-accepted audit-shield record';
  }
}
