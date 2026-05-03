import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const pubKey = process.env.CRUZAR_TICKET_PUBLIC_KEY;
  const keyId = process.env.CRUZAR_TICKET_KEY_ID;
  if (!pubKey || !keyId) {
    return NextResponse.json({ error: 'public_key_not_configured' }, { status: 500 });
  }
  return NextResponse.json({
    public_key_b64: pubKey,
    key_id: keyId,
    algorithm: 'Ed25519',
    issuer: 'Cruzar Insights, Inc.',
    spec_version: 'cruzar-ticket-v1',
  });
}
