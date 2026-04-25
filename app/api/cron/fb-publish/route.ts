import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase'
import { postPhoto, fbPostUrl } from '@/lib/fbGraph'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Native Graph API publisher for the Cruzar FB Page.
//
// Replaces the Make.com loop that ran build → 2026-04-25. That loop
// surfaced as "Published by Make" (algo discount) and posted text-only
// (no media boost). 28-day stats: 2,707 views, 0 reactions, 78% follower-
// only reach. This route publishes natively as the Page with a live
// wait-time image attached → photo post, no third-party tag.
//
// Schedule on cron-job.org: 5:30am, 11:30am, 3:30pm, 7:00pm CT.
//
// Coexistence with Make: deliberately self-sufficient. fb-publish does
// NOT use /api/social/next-post's dedupe gate (which counts every row,
// including Make-driven ones). Instead it dedupes against its OWN past
// publishes — `social_posts WHERE fb_post_id IS NOT NULL` rows are the
// only ones that block. Make's rows have fb_post_id = NULL and are
// invisible to this dedupe. So Make can stay enabled (with risk of
// double-posting on the FB page itself) or be disabled (clean) without
// affecting whether fb-publish fires.

const MIN_GAP_MINUTES = 180

function captionHash(caption: string): string {
  // Same hashing rule as /api/social/next-post — strip the timestamp
  // and weekday lines so reruns within the same scheduled slot collapse
  // to the same hash. Used for analytics/grouping, not for dedupe (we
  // dedupe on fb_posted_at instead — see above).
  const stripped = caption
    .split('\n')
    .filter((line) => !/TIEMPOS EN LOS PUENTES/i.test(line))
    .filter((line) => !/^(Lunes|Martes|Miercoles|Miércoles|Jueves|Viernes|Sabado|Sábado|Domingo)/i.test(line))
    .join('\n')
  return createHash('sha256').update(stripped).digest('hex').slice(0, 16)
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = req.nextUrl.searchParams.get('force') === '1'
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
  const cronSecret = process.env.CRON_SECRET!
  const db = getServiceClient()

  // Step 1: self-dedupe. Only count rows we (the native publisher) wrote
  // — fb_post_id IS NOT NULL means we successfully posted via Graph API.
  // Rows from Make's polling have fb_post_id = NULL and don't block us.
  if (!force) {
    const since = new Date(Date.now() - MIN_GAP_MINUTES * 60_000).toISOString()
    const { data: recent } = await db
      .from('social_posts')
      .select('id, fb_posted_at, fb_post_id')
      .eq('platform', 'facebook_page')
      .not('fb_post_id', 'is', null)
      .gte('fb_posted_at', since)
      .order('fb_posted_at', { ascending: false })
      .limit(1)
    if (recent && recent.length > 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'native_publisher_recent_post',
        lastPostedAt: recent[0].fb_posted_at,
        lastFbPostId: recent[0].fb_post_id,
        minGapMinutes: MIN_GAP_MINUTES,
      })
    }
  }

  // Step 2: fetch a fresh caption. Pass force=1 so next-post returns
  // the caption WITHOUT inserting a social_posts row (we manage our own
  // row inserts here so the row carries fb_post_id from the start).
  const nextPostUrl = `${apiBase}/api/social/next-post?secret=${encodeURIComponent(cronSecret)}&force=1`
  let nextPost: { caption?: string } = {}
  try {
    const res = await fetch(nextPostUrl, { cache: 'no-store' })
    nextPost = await res.json()
  } catch (err) {
    return NextResponse.json({ ok: false, stage: 'next-post-fetch', error: String(err) }, { status: 502 })
  }
  if (!nextPost.caption) {
    return NextResponse.json({ ok: false, stage: 'caption-empty' }, { status: 502 })
  }

  const caption = nextPost.caption
  const hash = captionHash(caption)
  const ts = Date.now()
  const imageUrl = `${apiBase}/api/social-image?ts=${ts}`

  // Step 3: validate FB env. If missing, log a row with the error so the
  // admin panel surfaces it, then return 200 with ok:false (cron-job.org
  // treats non-2xx as job failure and retries — we don't want that here).
  const pageId = process.env.FACEBOOK_PAGE_ID
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!pageId || !pageToken) {
    await db.from('social_posts').insert({
      platform: 'facebook_page',
      caption,
      caption_hash: hash,
      image_url: imageUrl,
      image_kind: 'social-image',
      fb_post_error: 'FB_ENV_MISSING',
    })
    return NextResponse.json({
      ok: false,
      stage: 'env',
      error: 'FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN missing in production env',
      captionPreview: caption.slice(0, 120),
    })
  }

  // Step 4: post to Graph API.
  const fb = await postPhoto({
    pageId,
    accessToken: pageToken,
    imageUrl,
    caption,
  })

  // Step 5: insert the row carrying fb_post_id (or fb_post_error). This is
  // the row our own dedupe gate (Step 1) checks for in subsequent runs.
  if (fb.ok) {
    await db.from('social_posts').insert({
      platform: 'facebook_page',
      caption,
      caption_hash: hash,
      image_url: imageUrl,
      image_kind: 'social-image',
      fb_post_id: fb.postId || null,
      fb_posted_at: new Date().toISOString(),
    })
    return NextResponse.json({
      ok: true,
      posted: true,
      fbPostId: fb.postId,
      fbPostUrl: fb.postId ? fbPostUrl(fb.postId) : null,
    })
  }

  await db.from('social_posts').insert({
    platform: 'facebook_page',
    caption,
    caption_hash: hash,
    image_url: imageUrl,
    image_kind: 'social-image',
    fb_post_error: fb.error || `HTTP ${fb.rawStatus}`,
  })
  return NextResponse.json({
    ok: false,
    stage: 'graph-api',
    error: fb.error,
    rawStatus: fb.rawStatus,
    rawBody: fb.rawBody,
  }, { status: 502 })
}
