// app/api/ticket/sample/route.ts
// Returns a signed sample Cruzar Ticket — for spec readers + partner integrations
// to test their verifier against. The signature is REAL: signs against our
// production key. The payload uses fake data ("ACME Sample Importer") clearly
// marked as a sample. Cached in-memory for the lifetime of the lambda.

import { NextResponse } from 'next/server';
import { signTicket } from '@/lib/ticket/json-signer';
import type { CruzarTicketV1 } from '@/lib/ticket/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cached: { body: unknown; expiresAt: number } | null = null;

export async function GET() {
  // Cache for 1 hour — same sample doesn't need to be re-signed every request.
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body);
  }

  const payload: CruzarTicketV1 = {
    schema_version: 'v1',
    ticket_id: 'cr_sample_2026_05_04_aaaaaa',
    issued_at: '2026-05-04T00:00:00.000Z',
    issuer: 'Cruzar Insights, Inc.',
    modules_present: ['customs', 'pedimento', 'refunds', 'driver_pass'],
    shipment: {
      origin: { country: 'MX', city: 'Reynosa' },
      destination: { country: 'US', port_code: '2304' },
      importer_name: 'ACME Sample Importer LLC',
      bol_ref: 'SAMPLE-BOL-2026-001',
    },
    customs: undefined,
    audit_shield: {
      prior_disclosure_eligible: true,
      '19_USC_1592_basis': 'Sample audit-shield assertion. Real tickets carry the live regulator-specific basis at composition time.',
    },
    calibration: {},
    signing_key_id: process.env.CRUZAR_TICKET_KEY_ID ?? 'k1-unset',
    verify_url: 'https://www.cruzar.app/ticket/cr_sample_2026_05_04_aaaaaa',
  };

  let body: unknown;
  try {
    const signed = await signTicket(payload);
    body = {
      _note: 'This is a sample Cruzar Ticket. The signature is REAL — verify it against our public key at /.well-known/cruzar-ticket-key.json. The payload contents are fictional.',
      _spec: 'https://www.cruzar.app/spec/ticket-v1',
      _public_key: 'https://www.cruzar.app/.well-known/cruzar-ticket-key.json',
      _verify_endpoint: 'https://www.cruzar.app/api/ticket/verify-payload',
      signed,
    };
  } catch (e) {
    return NextResponse.json(
      { error: 'signing_unavailable', detail: (e as Error).message },
      { status: 503 },
    );
  }

  cached = { body, expiresAt: Date.now() + 3600_000 };
  return NextResponse.json(body);
}
