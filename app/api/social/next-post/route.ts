import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// RGV-only port set. v1+v2 captions mixed RGV + Brownsville + Laredo
// in one post — Diego flagged that as the core problem ("the bridges
// have non relevance to each other"). v3 is single-region: someone in
// the Lower RGV cares about Hidalgo/Pharr/Anzaldúas/Brownsville
// bridges, not Laredo (different metro 150 mi north). Laredo and
// El Paso get their own pipelines later.
const FEATURED = [
  { portId: '230501', name: 'Hidalgo' },
  { portId: '230502', name: 'Pharr' },
  { portId: '230503', name: 'Anzaldúas' },
  { portId: '230901', name: 'Progreso' },
  { portId: '230902', name: 'Donna' },
  { portId: '535501', name: 'Brownsville Gateway' },
  { portId: '535502', name: 'Brownsville Veterans' },
  { portId: '535503', name: 'Los Tomates' },
]

// Bridge-specific hashtag for cleaner local discovery
const BRIDGE_HASHTAG: Record<string, string> = {
  '230501': '#Hidalgo',
  '230502': '#Pharr',
  '230503': '#Anzalduas',
  '230901': '#Progreso',
  '230902': '#Donna',
  '535501': '#Brownsville',
  '535502': '#Brownsville',
  '535503': '#LosTomates',
}

// Minimum gap between posts on the same platform. Make.com is supposed to
// fire 4×/day (~4h apart); 3h is a safe floor that catches double-firings
// without blocking the next legitimate scheduled run.
const MIN_GAP_MINUTES = 180

function emoji(wait: number | null): string {
  if (wait == null) return ''
  if (wait <= 20) return '🟢'
  if (wait <= 45) return '🟡'
  return '🔴'
}

function captionHash(caption: string): string {
  // Strip the timestamp + date lines so reruns within the same scheduled
  // slot collapse to the same hash even if the minute ticked over.
  const stripped = caption
    .split('\n')
    .filter((line) => !/TIEMPOS EN LOS PUENTES/i.test(line))
    .filter((line) => !/^(Lunes|Martes|Miercoles|Miércoles|Jueves|Viernes|Sabado|Sábado|Domingo)/i.test(line))
    .join('\n')
  return createHash('sha256').update(stripped).digest('hex').slice(0, 16)
}

export async function GET(request: Request): Promise<Response> {
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
  const url = new URL(request.url)
  const force = url.searchParams.get('force') === '1'

  const db = getServiceClient()

  // Dedupe: if a facebook_page post went out within MIN_GAP_MINUTES, skip.
  if (!force) {
    const since = new Date(Date.now() - MIN_GAP_MINUTES * 60_000).toISOString()
    const { data: recent } = await db
      .from('social_posts')
      .select('id, posted_at, caption_hash')
      .eq('platform', 'facebook_page')
      .gte('posted_at', since)
      .order('posted_at', { ascending: false })
      .limit(1)
    if (recent && recent.length > 0) {
      return NextResponse.json({
        skip: true,
        reason: 'recent_post_exists',
        lastPostedAt: recent[0].posted_at,
        minGapMinutes: MIN_GAP_MINUTES,
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  // Single-bridge focus: pick the fastest open RGV bridge with real data.
  let fastest: { portId: string; name: string; wait: number } | null = null
  try {
    const res = await fetch('https://www.cruzar.app/api/ports', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Cruzar-Social/1.0' },
    })
    const json = (await res.json()) as { ports?: { portId: string; vehicle?: number | null; isClosed?: boolean }[] }
    const ports = json.ports || []
    fastest = FEATURED
      .map((f) => {
        const p = ports.find((x) => x.portId === f.portId)
        const wait = p?.isClosed ? null : (p?.vehicle ?? null)
        return { ...f, wait }
      })
      .filter((x): x is typeof x & { wait: number } => x.wait != null && x.wait >= 0)
      .sort((a, b) => a.wait - b.wait)[0] || null
  } catch (err) {
    console.error('[next-post] Failed to fetch ports:', err)
  }
  // Fallback if all RGV bridges have no data — never block the cron slot.
  if (!fastest) fastest = { portId: '230503', name: 'Anzaldúas', wait: 5 }

  let videoUrl: string | null = null
  try {
    const { data } = await db
      .from('public_assets')
      .select('value')
      .eq('name', 'video_manifest')
      .single()
    const manifest = data?.value as { videos?: { url: string; compositionId: string }[] } | null
    const organic = manifest?.videos?.find((v) => v.compositionId === 'WaitTimes')
    if (organic?.url) videoUrl = organic.url
  } catch { /* no video yet */ }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  })
  const dowStr = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'America/Chicago' }).format(now)
  const dowCap = dowStr.charAt(0).toUpperCase() + dowStr.slice(1)

  const utmUrl = `https://cruzar.app/?utm_source=facebook&utm_medium=page_post&utm_campaign=organic_${now.toISOString().split('T')[0]}`

  // Headline language depends on the wait. Below 20 min is "rapidísimo,"
  // 20-45 is "el más rápido del Valle ahorita," 45+ is a warning frame
  // (the day is bad — pick the least-bad option).
  const w = fastest.wait
  let headline: string
  if (w <= 20) {
    headline = w === 0
      ? `🚦 ${fastest.name} está VACÍO ahorita.`
      : `🚦 ${fastest.name} está rapidísimo: ${w} min.`
  } else if (w <= 45) {
    headline = `🚦 El más rápido del Valle ahorita: ${fastest.name} — ${w} min.`
  } else {
    headline = `⚠️ Día pesado en los puentes. El "menos peor" ahorita es ${fastest.name} con ${w} min.`
  }

  const bridgeTag = BRIDGE_HASHTAG[fastest.portId] || ''
  const hashtags = `#RGV #cruzar #tiemposdeespera ${bridgeTag}`.trim()

  const caption = `${headline}

📲 cruzar.app — checa antes de salir.

${hashtags}`

  // Live wait-time card rendered by /api/social-image. Cache-busted so
  // Graph API always pulls a fresh PNG when /api/cron/fb-publish posts.
  // Was the static /opengraph-image until 2026-04-25 — that gave FB a
  // generic brand card on every post; the live card lets the photo
  // itself carry the wait-time data the caption is talking about.
  const imageUrl = `${apiBase}/api/social-image?ts=${now.getTime()}`
  const hash = captionHash(caption)

  // Record this post BEFORE returning so the next call dedupes against it.
  // If the row insert fails we still return the caption (don't block posting),
  // but log so we can fix the dedupe gap.
  // force=1 is reserved for read-only probes (e.g. the promoter dashboard
  // preview) — don't record those, or they'd fake out the dedupe window.
  if (!force) {
    try {
      await db.from('social_posts').insert({
        platform: 'facebook_page',
        caption,
        caption_hash: hash,
        video_url: videoUrl,
        image_url: imageUrl,
        landing_url: utmUrl,
      })
    } catch (err) {
      console.error('[next-post] Failed to record social_posts row:', err)
    }
  }

  return NextResponse.json({
    caption,
    videoUrl,
    imageUrl,
    landingUrl: utmUrl,
    hashtags,
    generatedAt: now.toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
