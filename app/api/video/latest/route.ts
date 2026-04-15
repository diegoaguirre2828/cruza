import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// /api/video/latest
//
// GET — Public endpoint. Returns the most recent rendered videos (organic
//       + ad library entries) with URLs, aspect ratios, captions. Used by
//       Make.com to pull the latest daily video + caption for FB auto-posting.
//
// POST — Auth-gated via Bearer <CRON_SECRET>. Called by the GitHub Actions
//       render workflow after videos are uploaded to Vercel Blob. Stores
//       the manifest in the `public_assets` table (created in v27 if not
//       already present — falls back to just returning the last payload
//       in memory if the table doesn't exist yet).

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface VideoManifestEntry {
  compositionId: string
  aspect: string
  url: string
  outputName: string
}

interface ManifestPayload {
  videos: VideoManifestEntry[]
  generatedAt: string
  caption?: string | null
}

// In-memory fallback for environments where public_assets table hasn't
// been created. Lost on cold start but good enough for a quick smoke test.
let memoryCache: ManifestPayload | null = null

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const expected = process.env.CRON_SECRET
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: ManifestPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!Array.isArray(body.videos) || body.videos.length === 0) {
    return NextResponse.json({ error: 'missing_videos' }, { status: 400 })
  }

  const payload: ManifestPayload = {
    videos: body.videos,
    generatedAt: body.generatedAt || new Date().toISOString(),
    caption: body.caption ?? null,
  }

  memoryCache = payload

  // Try to persist to Supabase as a single row in `public_assets` keyed
  // on name='video_manifest'. Silently degrades if the table doesn't
  // exist — memoryCache still serves the GET until it's created.
  try {
    const db = getServiceClient()
    await db
      .from('public_assets')
      .upsert(
        { name: 'video_manifest', value: payload, updated_at: new Date().toISOString() },
        { onConflict: 'name' }
      )
  } catch {
    /* table might not exist yet — memoryCache is the source of truth */
  }

  return NextResponse.json({ ok: true, stored: payload.videos.length })
}

export async function GET() {
  // Prefer Supabase over memory cache so values survive cold starts.
  try {
    const db = getServiceClient()
    const { data } = await db
      .from('public_assets')
      .select('value, updated_at')
      .eq('name', 'video_manifest')
      .single()
    if (data?.value) {
      return NextResponse.json(
        { ...data.value, storedAt: data.updated_at },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
      )
    }
  } catch {
    /* table missing or query failed — fall through */
  }

  if (memoryCache) {
    return NextResponse.json(memoryCache)
  }

  return NextResponse.json({ videos: [], generatedAt: null, note: 'no renders yet' })
}
