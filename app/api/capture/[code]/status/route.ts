// app/api/capture/[code]/status/route.ts
// Desktop polls this every ~2s to see if the mobile upload has landed.
// Returns the session row (status + uploaded_blob_url + uploaded_filename
// + metadata) so the desktop UI can pull the captured doc immediately
// when status flips from 'pending' to 'received'.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!code || !/^[A-Z0-9]{4,12}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await sb
    .from('capture_sessions')
    .select('id, code, kind, status, uploaded_blob_url, uploaded_filename, uploaded_mime, uploaded_size_bytes, uploaded_at, metadata, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Auto-expire if past expires_at and still pending
  if (data.status === 'pending' && new Date(data.expires_at).getTime() < Date.now()) {
    await sb.from('capture_sessions').update({ status: 'expired' }).eq('id', data.id);
    return NextResponse.json({ ...data, status: 'expired' });
  }

  return NextResponse.json(data);
}
