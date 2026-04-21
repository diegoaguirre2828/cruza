import { NextResponse } from 'next/server'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { getServiceClient } from '@/lib/supabase'
import { fetchTrafficWaits } from '@/lib/traffic'
import { confidenceWeight } from '@/lib/geo'
import { getPortMeta } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

// Removed `export const dynamic = 'force-dynamic'` so the Cache-Control
// headers we return actually get respected by Vercel's edge. The route
// still re-runs whenever the edge cache expires (every 15s) — we just
// don't re-run it on every single request. 80-95% DB load reduction
// under traffic spikes.

const REPORT_FRESH_MIN = 30
const CBP_STALE_MIN = 25
// "Very stale" = older than this, we stop showing the number entirely and
// just ask for a community report. Below this, we still show stale CBP with
// a loud staleness badge — bad data beats no data when the user can see it's old.
const CBP_VERY_STALE_MIN = 180
const DIVERGE_THRESHOLD_MIN = 15
// HERE traffic API doesn't reliably detect stationary border queues —
// cars parked at an inspection booth aren't seen as "congestion" on a road.
// So a sub-10min traffic estimate on its own is not trustworthy and we'd
// rather fall back to stale CBP than show a confident "<1 min".
const TRAFFIC_ONLY_TRUST_FLOOR_MIN = 10
// Camera-vision readings older than this are considered stale. Cron
// runs every 15 min (scheduled externally), so 25 min covers one miss
// plus a bit of slack.
const CAMERA_STALE_MIN = 25
// Minimum delta between CBP and a high/medium-confidence camera reading
// for us to override CBP. Below this, any noise in either signal would
// cause flicker.
const CAMERA_OVERRIDE_DELTA_MIN = 10

interface RecentReport {
  port_id: string
  wait_minutes: number | null
  report_type: string
  created_at: string
  location_confidence?: string | null
}

function parseCbpRecorded(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return null
}

function weightedAvg(items: { val: number; weight: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.weight, 0)
  if (totalW === 0) return 0
  const sum = items.reduce((s, i) => s + i.val * i.weight, 0)
  return Math.round(sum / totalW)
}

export async function GET() {
  try {
    const ports = await fetchRgvWaitTimes()
    const cbpUpdatedAt = ports[0]?.recordedAt ?? null

    const db = getServiceClient()
    const sinceIso = new Date(Date.now() - REPORT_FRESH_MIN * 60 * 1000).toISOString()
    const portIds = ports.map((p) => p.portId)

    // Cutoff for camera readings: 25 min. Cron runs every 15 min; this
    // covers one miss plus slack.
    const cameraSinceIso = new Date(Date.now() - CAMERA_STALE_MIN * 60 * 1000).toISOString()

    const [reportsRes, trafficWaits, overridesRes, cameraReadingsRes] = await Promise.all([
      db
        .from('crossing_reports')
        .select('port_id, wait_minutes, report_type, created_at, location_confidence')
        .in('port_id', portIds)
        .is('hidden_at', null) // v35 moderation: community blend ignores admin-hidden reports
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false }),
      fetchTrafficWaits(portIds).catch(() => new Map<string, number>()),
      // Load local-name overrides so cards render whatever Diego set in the
      // admin Ports tab without needing a redeploy. Defaults to static
      // portMeta.localName if no override row exists.
      db.from('port_overrides').select('port_id, local_name'),
      // Latest camera reading per port within the freshness window.
      // Ordered DESC so we can dedupe client-side to "most recent per
      // port." Filter out readings the model flagged as error / low-
      // confidence — they're noise, not signal.
      db
        .from('camera_wait_readings')
        .select('port_id, minutes_estimated, confidence, captured_at')
        .in('port_id', portIds)
        .gte('captured_at', cameraSinceIso)
        .is('error_code', null)
        .not('minutes_estimated', 'is', null)
        .order('captured_at', { ascending: false }),
    ])

    // Build a map of portId → latest camera reading (only first per port
    // since the query is already DESC by captured_at).
    const cameraByPort = new Map<
      string,
      { minutes: number; confidence: 'high' | 'medium' | 'low'; capturedAt: string }
    >()
    for (const row of cameraReadingsRes.data ?? []) {
      if (!cameraByPort.has(row.port_id) && row.minutes_estimated != null) {
        cameraByPort.set(row.port_id, {
          minutes: row.minutes_estimated,
          confidence: row.confidence as 'high' | 'medium' | 'low',
          capturedAt: row.captured_at,
        })
      }
    }
    // Historical averages — re-enabled 2026-04-16 after adding
    // idx_wait_time_readings_hour_port + idx_wait_time_readings_dow_hour_port.
    // Query scoped to current day_of_week + hour_of_day, last 30 days only.
    const historicalByPort = new Map<string, number>()
    try {
      const nowCT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
      const dow = nowCT.getDay()
      const hour = nowCT.getHours()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: histRows } = await db
        .from('wait_time_readings')
        .select('port_id, vehicle_wait')
        .eq('day_of_week', dow)
        .eq('hour_of_day', hour)
        .gte('recorded_at', thirtyDaysAgo)
        .not('vehicle_wait', 'is', null)
      if (histRows) {
        const sums = new Map<string, { total: number; count: number }>()
        for (const r of histRows) {
          const s = sums.get(r.port_id) ?? { total: 0, count: 0 }
          s.total += r.vehicle_wait
          s.count++
          sums.set(r.port_id, s)
        }
        for (const [pid, s] of sums) {
          if (s.count >= 3) historicalByPort.set(pid, Math.round(s.total / s.count))
        }
      }
    } catch {
      // Non-critical — if historical query fails, cards just won't show historical fallback
    }

    const overrideMap = new Map<string, string>()
    for (const o of overridesRes.data || []) {
      if (o.local_name) overrideMap.set(o.port_id, o.local_name)
    }

    const reportsByPort = new Map<string, RecentReport[]>()
    if (!reportsRes.error && reportsRes.data) {
      for (const r of reportsRes.data as RecentReport[]) {
        const arr = reportsByPort.get(r.port_id) ?? []
        arr.push(r)
        reportsByPort.set(r.port_id, arr)
      }
    }

    const now = Date.now()

    const blended: PortWaitTime[] = ports.map((p) => {
      const reports = reportsByPort.get(p.portId) ?? []
      // Drop reports flagged as 'far' (troll or wrong bridge). Weight the rest
      // by location confidence: near/nearby 3×, unknown 1×.
      const reportsWithWait = reports.filter(
        (r) => r.wait_minutes != null && r.wait_minutes >= 0 && r.location_confidence !== 'far',
      )
      const weightedItems = reportsWithWait.map((r) => ({
        val: r.wait_minutes as number,
        weight: confidenceWeight(r.location_confidence),
      }))
      const reportCount = reportsWithWait.length
      const communityVehicle =
        weightedItems.length > 0 ? weightedAvg(weightedItems) : null
      const lastReportMinAgo =
        reports.length > 0
          ? Math.round((now - new Date(reports[0].created_at).getTime()) / 60000)
          : null

      const trafficVehicle = trafficWaits.get(p.portId) ?? null

      // Camera-vision reading (Claude Haiku looking at the live feed).
      // Only fused when the model's own confidence is high/medium — 'low'
      // means the camera was dark / unclear / ambiguous.
      const camRow = cameraByPort.get(p.portId)
      const cameraVehicle = camRow?.minutes ?? null
      const cameraConfidence = camRow?.confidence ?? null
      const cameraAgeMin = camRow
        ? Math.round((now - new Date(camRow.capturedAt).getTime()) / 60000)
        : null
      const cameraUsable = camRow != null && (camRow.confidence === 'high' || camRow.confidence === 'medium')

      const cbpDate = parseCbpRecorded(p.recordedAt)
      const cbpStaleMin = cbpDate ? Math.round((now - cbpDate.getTime()) / 60000) : null
      const cbpIsStale = cbpStaleMin != null && cbpStaleMin > CBP_STALE_MIN
      const cbpIsVeryStale = cbpStaleMin != null && cbpStaleMin > CBP_VERY_STALE_MIN

      const cbpVehicle = p.vehicle
      const meta = getPortMeta(p.portId)
      const cbpLagHigh = meta?.cbpLag === 'high'

      let chosen: number | null = cbpVehicle
      let source: PortWaitTime['source'] = 'cbp'

      // ────────────────────────────────────────────────────────
      // Pick the headline number.
      //
      // Trust order:
      //   1. Community reports (≥1 fresh report) — humans on the ground
      //      beat any sensor.
      //   2. Camera-vision when it DIVERGES UP from CBP by ≥10 min and
      //      confidence is high/medium — specifically to catch the
      //      "CBP says 10 min but camera shows stuck queue" pattern
      //      Diego flagged for Brownsville B&M. We never let the camera
      //      drive the number DOWN below CBP (that way we can't
      //      accidentally mislead a user into leaving early based on a
      //      frame where the queue happened to be off-screen).
      //   3. Otherwise be CONSERVATIVE: pick the HIGHER of CBP / HERE /
      //      camera (when usable). Better to slightly over-state than
      //      to tell someone "0 min" when there's a 30 min line.
      //   4. Per-bridge trust downgrade: if cbpLag is 'high' (marked in
      //      portMeta for known-laggy sensors like B&M), refuse to
      //      publish a CBP-only "fast" number (<20 min) unless another
      //      signal confirms it — show the historical average instead.
      //   5. If CBP is very stale AND only signal is low traffic, refuse
      //      to answer and prompt a community report.
      // ────────────────────────────────────────────────────────
      if (communityVehicle != null && reportCount >= 1) {
        chosen = communityVehicle
        source = 'community'
      } else {
        const usableCbp = !cbpIsStale ? cbpVehicle : null
        const numerics: number[] = []
        if (usableCbp != null) numerics.push(usableCbp)
        if (trafficVehicle != null) numerics.push(trafficVehicle)
        if (cameraUsable && cameraVehicle != null) numerics.push(cameraVehicle)

        // (2) Camera divergence override — fires BEFORE the generic max()
        // logic so we get an explicit source='camera' label when the
        // camera is the reason the headline moved.
        if (
          cameraUsable &&
          cameraVehicle != null &&
          usableCbp != null &&
          cameraVehicle - usableCbp >= CAMERA_OVERRIDE_DELTA_MIN
        ) {
          chosen = cameraVehicle
          source = 'camera'
        } else if (numerics.length === 0) {
          // No fresh anything. Fall back to stale CBP if it's not ancient —
          // card will show a loud staleness badge + report CTA.
          if (cbpVehicle != null && !cbpIsVeryStale) {
            chosen = cbpVehicle
            source = 'cbp'
          } else {
            chosen = null
            source = 'cbp'
          }
        } else if (numerics.length === 1) {
          const only = numerics[0]
          if (usableCbp == null && only < TRAFFIC_ONLY_TRUST_FLOOR_MIN && !cameraUsable) {
            if (cbpVehicle != null && !cbpIsVeryStale) {
              chosen = cbpVehicle
              source = 'cbp'
            } else {
              chosen = null
              source = 'traffic'
            }
          } else {
            chosen = only
            if (only === cameraVehicle && cameraUsable) source = 'camera'
            else if (only === usableCbp) source = 'cbp'
            else source = 'traffic'
          }
        } else {
          const max = Math.max(...numerics)
          chosen = max
          const allCloseTogether = numerics.every(
            (n) => Math.abs(n - max) < DIVERGE_THRESHOLD_MIN,
          )
          if (allCloseTogether) {
            source = 'consensus'
          } else if (max === cameraVehicle && cameraUsable) {
            source = 'camera'
          } else if (max === usableCbp) {
            source = 'cbp'
          } else {
            source = 'traffic'
          }
        }

        // (4) Per-bridge CBP trust downgrade. When a sensor is known to
        // under-report (portMeta.cbpLag === 'high'), we refuse to
        // publish a CBP-only "it's fast" number unless ANOTHER signal
        // (camera, HERE traffic ≥ floor, or community) confirms. Keeps
        // the user from seeing "10 min" while the camera shows a
        // stopped queue. Fallback is the historical average for this
        // hour — at least that's truthful as a typical-wait reference.
        if (
          cbpLagHigh &&
          source === 'cbp' &&
          chosen != null &&
          chosen < 20
        ) {
          const hasCameraConfirm = cameraUsable && cameraVehicle != null && cameraVehicle < 20
          const hasTrafficConfirm = trafficVehicle != null && trafficVehicle >= TRAFFIC_ONLY_TRUST_FLOOR_MIN
          if (!hasCameraConfirm && !hasTrafficConfirm) {
            const historic = historicalByPort.get(p.portId)
            if (historic != null) {
              chosen = historic
              source = 'consensus' // honest fallback: "typical for this hour"
            } else {
              chosen = null
            }
          }
        }
      }

      const accidentCount = reports.filter(
        (r) => r.report_type === 'accident' || r.report_type === 'inspection',
      ).length
      if (accidentCount >= 2 && chosen != null && chosen < 30) {
        chosen = Math.max(chosen, 30)
      }

      return {
        ...p,
        vehicle: chosen,
        source,
        cbpVehicle,
        communityVehicle,
        trafficVehicle,
        cameraVehicle,
        cameraConfidence,
        cameraAgeMin,
        reportCount,
        lastReportMinAgo,
        cbpStaleMin,
        localNameOverride: overrideMap.get(p.portId) ?? null,
        historicalVehicle: historicalByPort.get(p.portId) ?? null,
      }
    })

    return NextResponse.json(
      {
        ports: blended,
        fetchedAt: new Date().toISOString(),
        cbpUpdatedAt,
      },
      {
        headers: {
          // Vercel edge cache: serve fresh for 30s, stale-while-revalidate
          // up to 2min. CBP data itself only updates every few minutes and
          // HERE traffic doesn't move second-to-second, so 30s is generous.
          // Bumped from 15s → 30s to halve the DB/CBP/HERE hit rate under
          // load after the Supabase disk-IO spike.
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      },
    )
  } catch (err) {
    console.error('Ports route error:', err)
    return NextResponse.json({ error: 'Failed to fetch wait times' }, { status: 502 })
  }
}
