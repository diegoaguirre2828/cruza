// app/api/scan/csv/route.ts
// CSV-mode universal scan. Accepts multipart/form-data with an ACE Entry
// Summary CSV file + importer identity fields, converts to a ShipmentBundle,
// runs the orchestrator. Output is the same MultiModuleComposition shape as
// /api/scan (JSON mode) — so the UI can route both modes through the same
// result renderer.
//
// This is the broker workflow: drop the CSV they already export from ACE,
// see every applicable module fire on those same entries.

import { NextRequest, NextResponse } from 'next/server';
import { aceCsvToBundle } from '@/lib/chassis/shared/ace-csv-to-bundle';
import { orchestrate } from '@/lib/chassis/orchestrator';

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

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'multipart_required', expected_fields: ['csv (file)', 'importer_name', 'importer_ein'] },
      { status: 400 },
    );
  }

  const fd = await req.formData();
  const file = fd.get('csv');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'csv_file_required' }, { status: 400 });
  }
  const csvText = await file.text();
  if (csvText.length > 5_000_000) {
    return NextResponse.json({ error: 'csv_too_large', max_bytes: 5_000_000 }, { status: 413 });
  }

  const importer_name = (fd.get('importer_name') as string | null)?.trim() || 'PUBLIC_SCAN';
  const importer_ein = (fd.get('importer_ein') as string | null)?.trim() || 'PUBLIC_SCAN';

  const { bundle, errors, entries_parsed } = aceCsvToBundle(csvText, {
    legal_name: importer_name.slice(0, 200),
    ein: importer_ein.slice(0, 30),
    language: 'en',
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: 'csv_parse_failed', detail: errors }, { status: 400 });
  }
  if (entries_parsed === 0) {
    return NextResponse.json({ error: 'no_entries_found' }, { status: 400 });
  }
  if (entries_parsed > 200) {
    return NextResponse.json({ error: 'too_many_entries', max: 200, entries_parsed }, { status: 400 });
  }

  const composition = await orchestrate(bundle, { skipScreening: true });

  return NextResponse.json({
    ...composition,
    csv_meta: {
      entries_parsed,
      filename: (file.name && file.name.length < 200) ? file.name : null,
    },
    spec_url: 'https://www.cruzar.app/spec/ticket-v1',
    cta: composition.modules_fired.length > 0
      ? 'Sign up to compose a signed Cruzar Ticket from this scan'
      : 'No modules fired against this CSV — entries may need export records (drawback) or supply chain map (UFLPA)',
  });
}
