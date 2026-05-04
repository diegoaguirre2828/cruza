import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { PORT_META } from '@/lib/portMeta'
import { POINTS } from '@/lib/points'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/auto-crossings
//
// Anonymized bridge-crossing observation produced by the in-app
// auto-detection (useCrossingDetector). The user's session cookie is
// used ONLY to:
//   1. honor the per-profile opt-in flag, and
//   2. award points to the contributing profile,
// and is then dropped — the wait_time_readings row never carries a
// user_id, so the dataset is anonymous at rest. See thinker session
// 2026-04-25 for the privacy posture rationale.

const ALLOWED_LANES = new Set(['general', 'sentri', 'commercial', 'pedestrian'])
const ALLOWED_SIDES = new Set(['US', 'MX'])
const ALLOWED_REASONS = new Set(['docs', 'inspection', 'construction', 'protest', 'other'])
const ALLOWED_PLATFORMS = new Set(['ios_native', 'web_mobile', 'web_desktop'])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  // Per-IP / per-user limit so a buggy client (or hostile script) can't
  // pollute the dataset with phantom crossings. 30/hr burst 5 matches
  // the /api/ads pattern.
  const rl = await checkRateLimit(keyFromRequest(req, user?.id), 30, 5)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many submissions. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  let body: {
    port_id?: string
    side_in?: string
    side_out?: string
    dt_minutes?: number
    lane_guess?: string
    reason_tag?: string
    platform?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const portId = (body.port_id || '').trim()
  const sideIn = (body.side_in || '').trim()
  const sideOut = (body.side_out || '').trim()
  const dt = typeof body.dt_minutes === 'number' && Number.isFinite(body.dt_minutes)
    ? Math.round(body.dt_minutes)
    : null
  const laneRaw = typeof body.lane_guess === 'string' ? body.lane_guess.trim().toLowerCase() : 'general'
  const lane = ALLOWED_LANES.has(laneRaw) ? laneRaw : 'general'
  const reasonRaw = typeof body.reason_tag === 'string' ? body.reason_tag.trim().toLowerCase() : ''
  const reasonTag = ALLOWED_REASONS.has(reasonRaw) ? reasonRaw : null
  const platformRaw = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : ''
  const platform = ALLOWED_PLATFORMS.has(platformRaw) ? platformRaw : null

  if (!portId || !PORT_META[portId]) {
    return NextResponse.json({ error: 'Unknown port_id' }, { status: 400 })
  }
  if (!ALLOWED_SIDES.has(sideIn) || !ALLOWED_SIDES.has(sideOut) || sideIn === sideOut) {
    return NextResponse.json({ error: 'side_in / side_out must be different (US ↔ MX)' }, { status: 400 })
  }
  if (dt == null || dt < 1 || dt > 720) {
    return NextResponse.json({ error: 'dt_minutes must be between 1 and 720' }, { status: 400 })
  }

  const direction = sideIn === 'MX' && sideOut === 'US' ? 'northbound' : 'southbound'

  const db = getServiceClient()

  // Auto-crossing detection is on by default. The user's tap on
  // "I'm in line now" is the per-crossing consent; we only refuse
  // submissions from profiles that have explicitly opted OUT in
  // /account (auto_geofence_opt_in === false). Award points to
  // authed users who land here.
  let pointsEarned = 0
  if (user) {
    const { data: profile } = await db
      .from('profiles')
      .select('points, auto_geofence_opt_in')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.auto_geofence_opt_in === false) {
      return NextResponse.json(
        { error: 'Auto-crossing detection disabled for this profile.' },
        { status: 403 },
      )
    }
    pointsEarned = POINTS.auto_geofence_crossing
    await db
      .from('profiles')
      .update({ points: (profile?.points || 0) + pointsEarned })
      .eq('id', user.id)
  }

  // Anonymized write: NO user_id, NO position, only the structured
  // observation. now() is the recorded_at default on wait_time_readings.
  const meta = PORT_META[portId]
  const portName = meta.localName || meta.city
  const now = new Date()
  const { error } = await db.from('wait_time_readings').insert({
    port_id: portId,
    port_name: portName,
    crossing_name: portName,
    vehicle_wait: direction === 'northbound' && lane === 'general' ? dt : null,
    sentri_wait: lane === 'sentri' ? dt : null,
    pedestrian_wait: lane === 'pedestrian' ? dt : null,
    commercial_wait: lane === 'commercial' ? dt : null,
    recorded_at: now.toISOString(),
    day_of_week: now.getUTCDay(),
    hour_of_day: now.getUTCHours(),
    source: 'auto_geofence',
    lane_guess: lane,
    reason_tag: reasonTag,
    platform,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Cruzar Crossing substrate (v85, 2026-05-04): if the user is authed
  // and opted-in, write a SEPARATE user-private crossing record + auto-
  // snooze any matching alert. This is intentionally a different table
  // than wait_time_readings — wait_time_readings is anonymized at rest
  // (the privacy posture from 2026-04-25), `crossings` carries user_id
  // for personalization + per-user history. The two writes serve
  // different purposes and don't leak into each other.
  let crossingId: string | null = null
  let snoozedAlertId: string | null = null
  if (user) {
    try {
      const detectedAt = now.toISOString()
      const direction_norm = direction === 'northbound' ? 'mx_to_us' : 'us_to_mx'
      const snoozeUntil = new Date(now.getTime() + 16 * 60 * 60 * 1000).toISOString()

      // Find a matching active alert to snooze.
      const { data: matchingAlert } = await db
        .from('alert_preferences')
        .select('id')
        .eq('user_id', user.id)
        .eq('port_id', portId)
        .eq('active', true)
        .or('snoozed_until.is.null,snoozed_until.lt.now()')
        .limit(1)
        .maybeSingle()
      if (matchingAlert) {
        snoozedAlertId = matchingAlert.id
        await db
          .from('alert_preferences')
          .update({ snoozed_until: snoozeUntil })
          .eq('id', matchingAlert.id)
      }

      // Compose the signed crossing.
      const { composeCrossing } = await import('@/lib/crossing/generate')
      const { payload, signed } = await composeCrossing({
        user_id: user.id,
        port_id: portId,
        port_name: portName,
        direction: direction_norm,
        status: 'completed',
        detection: {
          detected_at: detectedAt,
          detection_source: 'geofence_exit',
          confidence: 0.9,
          duration_min: dt ?? undefined,
          lane_inferred: lane === 'general' ? 'vehicle' : (lane as 'sentri' | 'pedestrian' | 'commercial'),
        },
        ...(snoozedAlertId
          ? {
              closure: {
                closed_at: detectedAt,
                reason: 'auto_geofence_exit' as const,
                alert_id_snoozed: snoozedAlertId,
                snoozed_until: snoozeUntil,
              },
            }
          : {}),
      })

      const { error: cErr } = await db.from('crossings').insert({
        id: payload.id,
        user_id: user.id,
        port_id: payload.port_id,
        direction: payload.direction,
        status: payload.status,
        modules_present: payload.modules_present,
        cohort_tags: payload.cohort_tags,
        blocks: payload.blocks,
        signature: signed.signature_b64,
        signed_at: detectedAt,
        signing_key_id: signed.signing_key_id,
        started_at: payload.started_at,
        ended_at: detectedAt,
      })
      if (!cErr) crossingId = payload.id
    } catch {
      // Crossing-record side-effect must never break the primary
      // anonymized auto-crossing write. Swallow.
    }
  }

  return NextResponse.json({ ok: true, direction, pointsEarned, crossing_id: crossingId, snoozed_alert_id: snoozedAlertId })
}
