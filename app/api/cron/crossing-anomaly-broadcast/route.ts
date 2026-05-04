import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { PORT_META } from '@/lib/portMeta'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// /api/cron/crossing-anomaly-broadcast
//
// Real-time bridge-incident detector built on the Cruzar Crossing
// substrate (Phase 4 per docs/cruzar-crossing-record-brainstorm.md).
//
// Logic:
//   1. For each port with ≥5 completed crossings in the last 30 min,
//      compute the rolling-30min average duration.
//   2. Compare against the port's prior 7-day median (excluding the
//      30-min window being scored).
//   3. If avg_30min > 1.5 × median_7d, flag as anomaly.
//   4. Push notification to all users with active alerts at that port
//      whose snoozed_until is null/past.
//
// Designed to run every 15 min via cron-job.org. Idempotent — fires
// once per port per anomaly window via dedupe key written to
// alert_preferences.last_anomaly_fire_at (added below if missing).
//
// Auth: ?secret=CRON_SECRET OR Authorization: Bearer CRON_SECRET
// (matches /api/cron/send-alerts pattern).

const WINDOW_MIN = 30
const MIN_SAMPLES = 5
const ANOMALY_RATIO = 1.5
const DEDUPE_HOURS = 2 // don't refire to same alert within this window

interface CrossingRow {
  port_id: string
  started_at: string
  ended_at: string | null
}

function durationMin(r: CrossingRow): number | null {
  if (!r.ended_at) return null
  const ms = new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
  if (!isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60000)
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

interface PushSub { endpoint: string; p256dh: string; auth: string }

async function pushAnomalyToUser(
  userId: string,
  portName: string,
  portId: string,
  observedMin: number,
  baselineMin: number,
  lang: 'en' | 'es',
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return 0
  const db = getServiceClient()
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (!subs?.length) return 0

  const es = lang === 'es'
  const title = es
    ? `⚠️ ${portName} se está atorando ahorita`
    : `⚠️ ${portName} is jamming up right now`
  const body = es
    ? `Promedio actual ~${observedMin} min vs típico ~${baselineMin} min. Considera otro puente o espera.`
    : `Current avg ~${observedMin} min vs typical ~${baselineMin} min. Try another bridge or wait it out.`

  const payload = JSON.stringify({
    title,
    body,
    tag: `anomaly-${portId}`,
    data: { url: `/port/${portId}`, kind: 'crossing_anomaly', port_id: portId },
  })

  let delivered = 0
  for (const sub of subs as PushSub[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      delivered++
    } catch (err: unknown) {
      const status = typeof err === 'object' && err !== null && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : 0
      if (status === 410 || status === 404) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }
  return delivered
}

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = req.nextUrl.searchParams.get('secret')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const now = Date.now()
  const windowStart = new Date(now - WINDOW_MIN * 60 * 1000).toISOString()
  const baselineStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Pull all completed crossings in the last 7 days. We split into
  // (a) windowed (last 30 min) and (b) baseline (the rest) below.
  const { data: rows, error } = await db
    .from('crossings')
    .select('port_id, started_at, ended_at')
    .eq('status', 'completed')
    .gte('started_at', baselineStart)
    .limit(20000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const all = (rows ?? []) as CrossingRow[]

  // Group by port
  const byPort = new Map<string, CrossingRow[]>()
  for (const r of all) {
    const arr = byPort.get(r.port_id) ?? []
    arr.push(r)
    byPort.set(r.port_id, arr)
  }

  const results: Array<{
    port_id: string
    observed_avg: number
    baseline_median: number
    samples_window: number
    samples_baseline: number
    pushed: number
    skipped_dedupe: number
    fired: boolean
  }> = []

  for (const [portId, portRows] of byPort.entries()) {
    if (!PORT_META[portId]) continue

    const windowDurations = portRows
      .filter(r => r.started_at >= windowStart)
      .map(durationMin)
      .filter((m): m is number => m != null && m > 0 && m <= 360)
    const baselineDurations = portRows
      .filter(r => r.started_at < windowStart)
      .map(durationMin)
      .filter((m): m is number => m != null && m > 0 && m <= 360)

    if (windowDurations.length < MIN_SAMPLES) continue
    if (baselineDurations.length < 10) continue

    const observed_avg = Math.round(
      windowDurations.reduce((a, b) => a + b, 0) / windowDurations.length
    )
    const baseline_median = median(baselineDurations)
    if (baseline_median <= 0) continue

    const fired = observed_avg > baseline_median * ANOMALY_RATIO
    if (!fired) continue

    // Find users with active alerts at this port whose snoozed_until is
    // null or past. Exclude ones we already paged within DEDUPE_HOURS.
    const dedupeCutoff = new Date(now - DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
    const { data: alerts } = await db
      .from('alert_preferences')
      .select('id, user_id, snoozed_until, last_anomaly_fire_at')
      .eq('port_id', portId)
      .eq('active', true)

    const portName = PORT_META[portId].localName || PORT_META[portId].city
    let pushed = 0
    let skippedDedupe = 0

    for (const a of (alerts ?? []) as { id: string; user_id: string; snoozed_until: string | null; last_anomaly_fire_at: string | null }[]) {
      if (a.snoozed_until && new Date(a.snoozed_until).getTime() > now) {
        skippedDedupe++
        continue
      }
      if (a.last_anomaly_fire_at && a.last_anomaly_fire_at > dedupeCutoff) {
        skippedDedupe++
        continue
      }
      const { data: prof } = await db
        .from('profiles')
        .select('language')
        .eq('id', a.user_id)
        .maybeSingle()
      const lang: 'en' | 'es' = prof?.language === 'en' ? 'en' : 'es'

      const delivered = await pushAnomalyToUser(
        a.user_id, portName, portId, observed_avg, baseline_median, lang,
      )
      if (delivered > 0) {
        pushed++
        await db
          .from('alert_preferences')
          .update({ last_anomaly_fire_at: new Date().toISOString() })
          .eq('id', a.id)
      }
    }

    results.push({
      port_id: portId,
      observed_avg,
      baseline_median,
      samples_window: windowDurations.length,
      samples_baseline: baselineDurations.length,
      pushed,
      skipped_dedupe: skippedDedupe,
      fired: true,
    })
  }

  return NextResponse.json({
    ok: true,
    window_min: WINDOW_MIN,
    ports_evaluated: byPort.size,
    anomalies_fired: results.length,
    results,
    at: new Date().toISOString(),
  })
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
