// lib/ticket/verifier.ts
// Officer-side verifier — fetches a Ticket by ID + verifies signature against
// the public key from /.well-known/cruzar-ticket-key.json.

import type { SignedTicket } from './types';
import { verifyTicket } from './json-signer';

export interface TicketVerifyResult {
  valid: boolean;
  reason?: string;
  ticket_id?: string;
  issued_at?: string;
  modules_present?: string[];
  superseded_by?: string;
}

export async function fetchAndVerifyTicket(ticketId: string, baseUrl = 'https://cruzar.app'): Promise<TicketVerifyResult> {
  // 1. Fetch the signed Ticket from public API
  const r = await fetch(`${baseUrl}/api/ticket/verify?id=${encodeURIComponent(ticketId)}`);
  if (!r.ok) return { valid: false, reason: `fetch failed: ${r.status}` };
  const body = await r.json() as { signed?: SignedTicket; superseded_by?: string; error?: string };
  if (body.error) return { valid: false, reason: body.error };
  if (!body.signed) return { valid: false, reason: 'no Ticket payload' };

  // 2. Fetch the public key
  const k = await fetch(`${baseUrl}/.well-known/cruzar-ticket-key.json`);
  if (!k.ok) return { valid: false, reason: `key fetch failed: ${k.status}` };
  const keyBody = await k.json() as { public_key_b64: string; key_id: string };

  // 3. Verify (async)
  const result = await verifyTicket(body.signed, keyBody.public_key_b64);
  return {
    valid: result.valid,
    reason: result.reason,
    ticket_id: body.signed.payload.ticket_id,
    issued_at: body.signed.payload.issued_at,
    modules_present: body.signed.payload.modules_present,
    superseded_by: body.superseded_by,
  };
}
