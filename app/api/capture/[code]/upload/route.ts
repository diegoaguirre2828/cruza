// app/api/capture/[code]/upload/route.ts
// Mobile posts a file. We persist to Vercel Blob, mark the session
// 'received', and return the blob URL. Desktop's polling sees status flip
// + can pull the URL immediately to continue its procedure.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB hard cap

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!code || !/^[A-Z0-9]{4,12}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart_required' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: session, error: lookupErr } = await sb
    .from('capture_sessions')
    .select('id, code, kind, status, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (lookupErr || !session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }
  if (session.status !== 'pending') {
    return NextResponse.json({ error: `session_${session.status}` }, { status: 410 });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await sb.from('capture_sessions').update({ status: 'expired' }).eq('id', session.id);
    return NextResponse.json({ error: 'session_expired' }, { status: 410 });
  }

  const fd = await req.formData();
  const file = fd.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_FILE_BYTES }, { status: 413 });
  }

  // Upload to Vercel Blob with a kind-prefixed key so we can lifecycle
  // captures separately if needed.
  const safeName = (file.name || 'capture').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const blobKey = `capture/${session.kind}/${session.code}/${Date.now()}-${safeName}`;
  const blob = await put(blobKey, file, { access: 'public', addRandomSuffix: false });

  const { error: updateErr } = await sb
    .from('capture_sessions')
    .update({
      status: 'received',
      uploaded_blob_url: blob.url,
      uploaded_filename: file.name,
      uploaded_mime: file.type,
      uploaded_size_bytes: file.size,
      uploaded_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  if (updateErr) {
    return NextResponse.json({ error: 'session_update_failed', detail: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    code: session.code,
    blob_url: blob.url,
    filename: file.name,
    size_bytes: file.size,
  });
}
