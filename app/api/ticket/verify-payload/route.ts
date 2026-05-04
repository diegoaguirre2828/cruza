// app/api/ticket/verify-payload/route.ts
// Public endpoint to verify an arbitrary signed Cruzar Ticket payload.
// Differs from /api/ticket/verify (GET ?id=X) which fetches by ticket ID from
// our DB. This endpoint accepts a SignedTicket object the caller already has,
// re-canonicalizes the payload, recomputes the content hash, fetches our
// published public key from /.well-known/, and verifies the Ed25519 signature.
//
// Use case: a partner / regulator / officer received a Cruzar Ticket out-of-band
// (PDF + QR / email / portal) and wants to verify it without trusting our
// database lookup. Same trust model as PGP — verify against the published key.

import { NextRequest, NextResponse } from 'next/server';
import { verifyTicket } from '@/lib/ticket/json-signer';
import type { SignedTicket } from '@/lib/ticket/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_PER_IP_PER_HOUR = 60;
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

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const signed = body as SignedTicket;
  if (!signed || typeof signed !== 'object' || !signed.payload || !signed.signature_b64 || !signed.content_hash) {
    return NextResponse.json(
      { error: 'malformed_signed_ticket', expected: ['payload', 'payload_canonical', 'content_hash', 'signature_b64', 'signing_key_id'] },
      { status: 400 },
    );
  }

  const result = await verifyTicket(signed, process.env.CRUZAR_TICKET_PUBLIC_KEY);

  return NextResponse.json({
    valid: result.valid,
    reason: result.reason,
    ticket_id: signed.payload?.ticket_id,
    issued_at: signed.payload?.issued_at,
    schema_version: signed.payload?.schema_version,
    issuer: signed.payload?.issuer,
    modules_present: signed.payload?.modules_present,
    signing_key_id: signed.signing_key_id,
    spec_version: 'cruzar-ticket-v1',
    spec_url: 'https://www.cruzar.app/spec/ticket-v1',
    public_key_url: 'https://www.cruzar.app/.well-known/cruzar-ticket-key.json',
  });
}
