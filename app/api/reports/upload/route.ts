import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Photo + voice attachment upload for inline bridge reports. Stores to
// Vercel Blob and returns the public URL — caller persists it inside
// crossing_reports.source_meta.attachments. Auth-gated to prevent
// random anonymous uploads filling the bucket.

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB hard ceiling
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  const portId = String(form.get('portId') || '').trim()
  const kind = String(form.get('kind') || '').trim()

  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'empty file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large (max 8 MB)' }, { status: 413 })
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `unsupported mime: ${file.type}` }, { status: 415 })
  }
  if (kind !== 'photo' && kind !== 'voice') {
    return NextResponse.json({ error: 'kind must be photo|voice' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || (file.type.split('/')[1] ?? 'bin')
  const key = `reports/${kind}/${portId}/${user.id}-${Date.now()}.${ext}`

  try {
    const blob = await put(key, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    })
    return NextResponse.json({ url: blob.url, kind, contentType: file.type, bytes: file.size })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'upload failed' }, { status: 500 })
  }
}
