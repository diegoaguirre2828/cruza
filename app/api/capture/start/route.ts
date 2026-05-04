// app/api/capture/start/route.ts
// Desktop creates a capture session. Returns a short code + the mobile URL
// the operator's phone should open. Code is the auth — anyone who knows
// it can upload to the session, so it's intentionally short-lived (15 min)
// and bound to the desktop's correlation token (so the desktop UI can
// poll only its own sessions).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Avoid characters that look alike in low-light camera shots: 0/O, 1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function genCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

interface StartBody {
  kind?: 'paperwork' | 'driver_doc' | 'affidavit' | 'general';
  desktop_session_token?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  let body: StartBody;
  try { body = await req.json(); } catch { body = {}; }

  const kind = body.kind ?? 'general';
  const allowedKinds = new Set(['paperwork', 'driver_doc', 'affidavit', 'general']);
  if (!allowedKinds.has(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Retry up to 3 times if collision (vanishingly rare with 30^6 = 729M space)
  let code = '';
  let row = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    code = genCode();
    const { data, error } = await sb
      .from('capture_sessions')
      .insert({
        code,
        kind,
        desktop_session_token: body.desktop_session_token ?? null,
        metadata: body.metadata ?? {},
      })
      .select('id, code, expires_at')
      .single();
    if (!error) {
      row = data;
      break;
    }
    // 23505 = unique violation; retry. Other errors bail.
    if (!error.message.includes('duplicate')) {
      return NextResponse.json({ error: 'session_create_failed', detail: error.message }, { status: 500 });
    }
  }

  if (!row) {
    return NextResponse.json({ error: 'session_create_failed', detail: 'code collision' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cruzar.app';
  return NextResponse.json({
    code: row.code,
    mobile_url: `${baseUrl}/capture/${row.code}`,
    expires_at: row.expires_at,
  });
}
