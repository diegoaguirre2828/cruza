// app/api/pedimento/scan/route.ts
// Free public VUCEM/pedimento composition scanner — no auth, IP-rate-limited.

import { NextRequest, NextResponse } from 'next/server';
import { composePedimento } from '@/lib/chassis/pedimento/composer';
import type { OperacionInput } from '@/lib/chassis/pedimento/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_PER_IP_PER_HOUR = 10;
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

  let body: OperacionInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body?.mercancias || !Array.isArray(body.mercancias) || body.mercancias.length === 0) {
    return NextResponse.json({ error: 'need_at_least_one_merchandise_line' }, { status: 400 });
  }
  if (body.mercancias.length > 50) {
    return NextResponse.json({ error: 'too_many_lines', max: 50 }, { status: 400 });
  }
  if (!body.agente || !body.importador_exportador) {
    return NextResponse.json({ error: 'missing_agente_or_importador' }, { status: 400 });
  }

  const comp = composePedimento(body);

  return NextResponse.json({
    clave: comp.clave,
    regimen: comp.regimen,
    rfc_validacion: comp.rfc_validacion,
    patente_validacion: comp.patente_validacion,
    padron_status: comp.padron_status,
    total_mercancias: comp.total_mercancias,
    total_valor_factura_usd: comp.total_valor_factura_usd,
    impuestos: comp.impuestos,
    findings: comp.findings,
    registry_version: comp.registry_version,
    cta: 'Sign up to compose the pedimento + DODA + integrate with your VUCEM filer.',
  });
}
