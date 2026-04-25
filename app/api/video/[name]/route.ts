import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Public proxy for private-Vercel-Blob videos.
//
// Why this exists: Vercel Blob videos are uploaded to a private store
// (URL hostname `<storeId>.private.blob.vercel-storage.com`). FB Graph
// API's /{page-id}/videos `file_url` parameter requires a publicly
// fetchable URL — anonymous GET to the private blob returns 403.
//
// This route looks up the requested filename in the public_assets
// `video_manifest` row, fetches the private blob server-side using
// the BLOB_READ_WRITE_TOKEN, and streams the bytes back to the
// caller. From FB's perspective, the video lives at
// https://cruzar.app/api/video/<filename> — public, fetchable, mp4.
//
// Auth model: NONE on this route. The video is about to be posted on
// the public FB Page — privacy-irrelevant. Anyone who guesses a
// filename can stream it. The filename includes a timestamp + random
// composition prefix so guessing is impractical, but treat any video
// you upload as effectively public the moment it lands here.

interface ManifestEntry {
  url: string
  outputName: string
  compositionId: string
  aspect: string
}
interface Manifest {
  videos?: ManifestEntry[]
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params
  if (!name || !name.endsWith('.mp4') || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  // Look up the URL in the manifest. Restricting to manifest entries
  // means /api/video/<arbitrary>.mp4 only resolves to videos this
  // pipeline has already declared as ready-to-post — defense against
  // someone guessing private-blob filenames they shouldn't reach.
  const db = getServiceClient()
  const { data: assetRow } = await db
    .from('public_assets')
    .select('value')
    .eq('name', 'video_manifest')
    .single()
  const manifest = (assetRow?.value as Manifest | null) || null
  const entry = manifest?.videos?.find(v => v.outputName === name)
  if (!entry?.url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch the private blob with the read/write token. Vercel Blob
  // private URLs accept the token via Authorization: Bearer header.
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN missing' }, { status: 500 })
  }

  const upstream = await fetch(entry.url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: 'Upstream fetch failed', status: upstream.status },
      { status: 502 },
    )
  }

  // Stream straight through. Set headers FB likes for video — proper
  // Content-Type + Content-Length when available + cache hint so the
  // CDN (and FB's fetcher) can cache for a short window.
  const headers = new Headers()
  headers.set('Content-Type', 'video/mp4')
  const len = upstream.headers.get('content-length')
  if (len) headers.set('Content-Length', len)
  headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')

  return new Response(upstream.body, { status: 200, headers })
}
