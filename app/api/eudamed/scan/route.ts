// app/api/eudamed/scan/route.ts
// Free public EUDAMED readiness check — no auth, IP-rate-limited.
// Tells caller whether their actor + one device meet EUDAMED submission
// requirements, without persisting anything. Mirror of /api/refunds/scan.

import { NextRequest, NextResponse } from 'next/server';
import { composeEudamedSubmission } from '@/lib/chassis/eudamed/composer';
import type { EudamedSubmissionInput } from '@/lib/chassis/eudamed/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_PER_IP_PER_HOUR = 20;
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

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const input = body as EudamedSubmissionInput;
  if (!input?.actor || !input?.devices) {
    return NextResponse.json({ error: 'missing_actor_or_devices' }, { status: 400 });
  }

  const composition = composeEudamedSubmission({
    ...input,
    captured_at: new Date().toISOString(),
  });

  return NextResponse.json({
    actor_ready: composition.actor_registration.is_submission_ready,
    actor_warnings: composition.actor_registration.validation_warnings,
    device_count: composition.device_count,
    ready_count: composition.ready_count,
    blocked_count: composition.blocked_count,
    device_validation: composition.device_validation,
    registry_version: composition.registry_version,
    cta: 'Sign up to capture full device inventory through Cruzar Ticket and export EUDAMED-ready feeds on every cross-border event.',
  });
}
