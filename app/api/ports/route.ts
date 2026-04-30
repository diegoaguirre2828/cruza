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
  lane_type?: string | null
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

// CBP outage fallback. When fetchRgvWaitTimes() throws (AbortError on
// hung CBP API, 5xx, etc.) the route used to return 502 and every port
// page rendered the global-error boundary — full app-down experience.
// Production hit this 2026-04-30 evening: CBP went unreachable around
// 18:00 UTC, the cron-job.org scraper started failing too (matched
// AbortError pattern in runtime logs), and from ~22:22 UTC every
// /api/ports request was 502. Fix: serve the most recent
// wait_time_readings row per port from the last 24h, mapped to the
// PortWaitTime shape. recordedAt stays the original timestamp so the
// downstream `cbpStaleMin` math correctly badges the row as stale —
// users see real (if old) numbers + a clear "X minutes ago" badge
// instead of a black error screen.
async function fetchPortsFromCache(): Promise<PortWaitTime[]> {
  const db = getServiceClient()
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await db
    .from('wait_time_readings')
    .select(
      'port_id, port_name, crossing_name, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, lanes_vehicle_open, lanes_sentri_open, lanes_pedestrian_open, lanes_commercial_open, recorded_at',
    )
    .gte('recorded_at', sinceIso)
    .order('recorded_at', { ascending: false })
  if (!data || data.length === 0) return []
  const seen = new Set<string>()
  const out: PortWaitTime[] = []
  for (const r of data) {
    if (seen.has(r.port_id)) continue
    seen.add(r.port_id)
    out.push({
      portId: r.port_id,
      portName: r.port_name ?? r.port_id,
      crossingName: r.crossing_name ?? '',
      city: r.port_name ?? '',
      vehicle: r.vehicle_wait,
      sentri: r.sentri_wait,
      pedestrian: r.pedestrian_wait,
      commercial: r.commercial_wait,
      vehicleLanesOpen: r.lanes_vehicle_open ?? null,
      sentriLanesOpen: r.lanes_sentri_open ?? null,
      pedestrianLanesOpen: r.lanes_pedestrian_open ?? null,
      commercialLanesOpen: r.lanes_commercial_open ?? null,
      isClosed: false,
      noData: false,
      vehicleClosed: false,
      pedestrianClosed: false,
      commercialClosed: false,
      recordedAt: r.recorded_at,
    })
  }
  return out
}

export async function GET() {
  try {
    let ports: PortWaitTime[]
    try {
      ports = await fetchRgvWaitTimes()
    } catch (cbpErr) {
      console.warn(
        '[ports] CBP fetch failed, falling back to wait_time_readings cache:',
        cbpErr instanceof Error ? cbpErr.message : String(cbpErr),
      )
      ports = await fetchPortsFromCache()
      if (ports.length === 0) throw cbpErr
    }
    const cbpUpdatedAt = ports[0]?.recordedAt ?? null

    const db = getServiceClient()
    const sinceIso = new Date(Date.now() - REPORT_FRESH_MIN * 60 * 1000).toISOString()
    const portIds = ports.map((p) => p.portId)

    // Cutoff for camera readings: 25 min. Cron runs every 15 min; this
    // covers one miss plus slack.
    const cameraSinceIso = new Date(Date.now() - CAMERA_STALE_MIN * 60 * 1000).toISOString()

    const [reportsRes, trafficWaits, overridesRes, cameraReadingsRes, btsBaselineRes] = await Promise.all([
      db
        .from('crossing_reports')
        .select('port_id, wait_minutes, report_type, created_at, location_confidence, lane_type')
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
      // confidence — they're noise, not signal. v55: also pull pedestrian
      // fields so the new pedestrian blend can use them.
      db
        .from('camera_wait_readings')
        .select('port_id, minutes_estimated, confidence, captured_at, pedestrians_estimated, pedestrian_minutes_estimated, pedestrian_confidence, pedestrian_lanes_visible')
        .in('port_id', portIds)
        .gte('captured_at', cameraSinceIso)
        .is('error_code', null)
        .order('captured_at', { ascending: false }),
      // BTS pedestrian baseline — monthly per-port averages from public
      // BTS data. Used as the "what is normal" context band on hero cards
      // and as the divisor in flow-rate math when camera count is available.
      db
        .from('bts_pedestrian_baseline')
        .select('port_id, year, month, pedestrians_count')
        .in('port_id', portIds)
        .order('year', { ascending: false })
        .order('month', { ascending: false }),
    ])

    // Build a map of portId → latest camera reading (only first per port
    // since the query is already DESC by captured_at). v55: same row
    // carries pedestrian fields when the model was able to see a
    // pedestrian queue in the same frame.
    const cameraByPort = new Map<
      string,
      {
        minutes: number | null
        confidence: 'high' | 'medium' | 'low' | null
        capturedAt: string
        pedMinutes: number | null
        pedCount: number | null
        pedConfidence: 'high' | 'medium' | 'low' | null
        pedLanes: number | null
      }
    >()
    for (const row of cameraReadingsRes.data ?? []) {
      if (cameraByPort.has(row.port_id)) continue
      // Skip rows that have neither vehicle nor pedestrian data — pure noise.
      if (row.minutes_estimated == null && row.pedestrian_minutes_estimated == null) continue
      cameraByPort.set(row.port_id, {
        minutes: row.minutes_estimated,
        confidence: row.confidence as 'high' | 'medium' | 'low' | null,
        capturedAt: row.captured_at,
        pedMinutes: row.pedestrian_minutes_estimated ?? null,
        pedCount: row.pedestrians_estimated ?? null,
        pedConfidence: (row.pedestrian_confidence as 'high' | 'medium' | 'low' | null) ?? null,
        pedLanes: row.pedestrian_lanes_visible ?? null,
      })
    }

    // BTS pedestrian baseline — pick the most recent month per port.
    // Convert the monthly aggregate to a flat hourly average. Intra-day
    // shape isn't modeled (BTS is monthly only) — the card frames this
    // honestly as "normalmente ~X/h por aquí."
    const btsByPort = new Map<string, number>()
    for (const row of btsBaselineRes.data ?? []) {
      if (btsByPort.has(row.port_id)) continue
      const perHour = Math.round((row.pedestrians_count / 30) / 24)
      if (perHour > 0) btsByPort.set(row.port_id, perHour)
    }
    // Historical averages — re-enabled 2026-04-16 after adding
    // idx_wait_time_readings_hour_port + idx_wait_time_readings_dow_hour_port.
    // Query scoped to current day_of_week + hour_of_day, last 30 days only.
    // v55d: also pull lanes_pedestrian_open so we can compute "officers
    // typical at this hour" — fewer officers than usual is a leading
    // indicator of wait spikes even when current wait is still low.
    const historicalByPort = new Map<string, number>()
    const pedestrianOfficersTypicalByPort = new Map<string, number>()
    const vehicleOfficersTypicalByPort = new Map<string, number>()
    const commercialOfficersTypicalByPort = new Map<string, number>()
    const sentriOfficersTypicalByPort = new Map<string, number>()
    try {
      const nowCT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
      const dow = nowCT.getDay()
      const hour = nowCT.getHours()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: histRows } = await db
        .from('wait_time_readings')
        .select('port_id, vehicle_wait, lanes_pedestrian_open, lanes_vehicle_open, lanes_commercial_open, lanes_sentri_open')
        .eq('day_of_week', dow)
        .eq('hour_of_day', hour)
        .gte('recorded_at', thirtyDaysAgo)
      if (histRows) {
        const waitSums = new Map<string, { total: number; count: number }>()
        const pedSums = new Map<string, { total: number; count: number }>()
        const vehSums = new Map<string, { total: number; count: number }>()
        const comSums = new Map<string, { total: number; count: number }>()
        const senSums = new Map<string, { total: number; count: number }>()
        const accumulate = (
          map: Map<string, { total: number; count: number }>,
          portId: string,
          val: number | null | undefined,
        ) => {
          if (val == null || val <= 0) return
          const s = map.get(portId) ?? { total: 0, count: 0 }
          s.total += val
          s.count++
          map.set(portId, s)
        }
        for (const r of histRows) {
          if (r.vehicle_wait != null) accumulate(waitSums, r.port_id, r.vehicle_wait)
          accumulate(pedSums, r.port_id, r.lanes_pedestrian_open)
          accumulate(vehSums, r.port_id, r.lanes_vehicle_open)
          accumulate(comSums, r.port_id, r.lanes_commercial_open)
          accumulate(senSums, r.port_id, r.lanes_sentri_open)
        }
        const finalize = (sums: Map<string, { total: number; count: number }>, target: Map<string, number>) => {
          for (const [pid, s] of sums) {
            if (s.count >= 3) target.set(pid, Math.round(s.total / s.count))
          }
        }
        finalize(waitSums, historicalByPort)
        finalize(pedSums, pedestrianOfficersTypicalByPort)
        finalize(vehSums, vehicleOfficersTypicalByPort)
        finalize(comSums, commercialOfficersTypicalByPort)
        finalize(senSums, sentriOfficersTypicalByPort)
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
      // Split by lane_type — vehicle blend ignores explicit-pedestrian
      // reports, pedestrian blend ignores explicit-vehicle/sentri/commercial.
      // Reports without lane_type fall into vehicle (legacy default).
      const vehicleReports = reportsWithWait.filter((r) => r.lane_type !== 'pedestrian')
      const pedestrianReports = reportsWithWait.filter((r) => r.lane_type === 'pedestrian')

      const weightedItems = vehicleReports.map((r) => ({
        val: r.wait_minutes as number,
        weight: confidenceWeight(r.location_confidence),
      }))
      const pedWeightedItems = pedestrianReports.map((r) => ({
        val: r.wait_minutes as number,
        weight: confidenceWeight(r.location_confidence),
      }))
      const reportCount = vehicleReports.length
      const communityVehicle =
        weightedItems.length > 0 ? weightedAvg(weightedItems) : null
      const communityPedestrian =
        pedWeightedItems.length > 0 ? weightedAvg(pedWeightedItems) : null
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

      // ────────────────────────────────────────────────────────
      // Pedestrian wait pick (v55).
      //
      // CBP's pedestrian field is sparse and often stale. Trust order
      // mirrors the vehicle blend but with one extra fallback layer:
      //   1. Pedestrian-tagged community reports (highest signal — humans
      //      in the actual line)
      //   2. Camera-vision pedestrian estimate when confidence is high/medium
      //      AND the model actually saw a pedestrian queue (pedCount != null)
      //   3. CBP pedestrian (the field was already on `p` from CBP)
      //   4. BTS baseline as a "we don't know live, but normally there are
      //      ~140 peatones/h here" context value — clearly tagged as
      //      'baseline' so the UI can render it differently
      // ────────────────────────────────────────────────────────
      const cbpPedestrian = p.pedestrian
      const cameraPedestrian = camRow?.pedMinutes ?? null
      const cameraPedestrianCount = camRow?.pedCount ?? null
      const cameraPedestrianConfidence = camRow?.pedConfidence ?? null
      const cameraPedestrianLanes = camRow?.pedLanes ?? null
      const cameraPedestrianUsable =
        cameraPedestrian != null &&
        cameraPedestrianCount != null &&
        (cameraPedestrianConfidence === 'high' || cameraPedestrianConfidence === 'medium')

      // ──── Flow-rate derived estimate ────
      // wait = queue_count / (officers × throughput_per_minute_per_officer)
      //
      // v55d throughput tune: pass-1 used 15/min/officer (= 4 sec/person)
      // which matches a SENTRI card swipe but NOT a typical booth where
      // the officer reviews documents, asks questions, and inspects
      // belongings. GAO-13-603 + CBP operational data put real per-booth
      // pedestrian throughput at ~30-90 sec/person depending on document
      // type, with US-citizen passport-card lane fastest (~10-15s) and
      // visa-waiver / B1B2 visitor lane slowest (~60-90s). Mid-mix
      // baseline of 3 people/min/officer (= 20 sec/person) reflects
      // the typical mixed-population queue at a US-MX pedestrian
      // crossing. SENTRI lanes get sized faster downstream.
      const PEDESTRIAN_THROUGHPUT_PER_OFFICER_PER_MIN = 3
      let pedestrianFlowRateMin: number | null = null
      if (
        cameraPedestrianCount != null &&
        cameraPedestrianLanes != null &&
        cameraPedestrianLanes > 0
      ) {
        const throughputPerMin = cameraPedestrianLanes * PEDESTRIAN_THROUGHPUT_PER_OFFICER_PER_MIN
        const flow = Math.round(cameraPedestrianCount / throughputPerMin)
        pedestrianFlowRateMin = Math.max(1, Math.min(flow, 120))
      }

      let pedestrianChosen: number | null = cbpPedestrian
      let pedestrianSource: PortWaitTime['pedestrianSource'] = cbpPedestrian != null ? 'cbp' : null

      // Pick order:
      //   1. Community reports tagged pedestrian — humans in the line
      //   2. Camera-vision direct minute estimate when high/medium conf
      //   3. Camera flow-rate (queue ÷ throughput) when conf is low but
      //      we still got a head count + booth count — math beats nothing
      //   4. CBP pedestrian field when present
      //   5. BTS baseline as last-resort context value
      if (communityPedestrian != null && pedestrianReports.length >= 1) {
        pedestrianChosen = communityPedestrian
        pedestrianSource = 'community'
      } else if (cameraPedestrianUsable) {
        pedestrianChosen = cameraPedestrian
        pedestrianSource = 'camera'
      } else if (
        pedestrianFlowRateMin != null &&
        (cbpPedestrian == null || cameraPedestrianCount! >= 5)
      ) {
        // Flow-rate wins over CBP when there's a substantive queue
        // (≥5 people) — that signal is more concrete than a CBP estimate.
        pedestrianChosen = pedestrianFlowRateMin
        pedestrianSource = 'flow_rate'
      } else if (cbpPedestrian == null && btsByPort.has(p.portId)) {
        // Last resort: convert hourly baseline to a rough wait-minute
        // estimate using ~3-sec-per-person booth throughput across 2
        // typical booths. Tagged 'baseline' so the UI can render it
        // differently from live readings.
        const hourly = btsByPort.get(p.portId)!
        const queueRoughMin = Math.round((hourly / 2400) * 60)
        pedestrianChosen = Math.max(1, Math.min(queueRoughMin, 60))
        pedestrianSource = 'baseline'
      }

      return {
        ...p,
        vehicle: chosen,
        // Headline pedestrian — overrides the CBP-only value `p.pedestrian`
        // had with the full-blend pick.
        pedestrian: pedestrianChosen,
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
        // Pedestrian sensor stack (v55)
        communityPedestrian,
        cameraPedestrian,
        cameraPedestrianCount,
        cameraPedestrianConfidence,
        pedestrianBaselineHourly: btsByPort.get(p.portId) ?? null,
        pedestrianSource,
        pedestrianFlowRateMin,
        // Officer staffing — CBP exposes lanes_open every poll; this
        // is the most-current "officers working right now" signal
        // available without internal CBP system access. Per-lane
        // typicals computed above from 30 days of wait_time_readings
        // at this hour-of-day.
        pedestrianOfficersOpen: p.pedestrianLanesOpen ?? null,
        pedestrianOfficersTypical: pedestrianOfficersTypicalByPort.get(p.portId) ?? null,
        vehicleOfficersTypical: vehicleOfficersTypicalByPort.get(p.portId) ?? null,
        commercialOfficersTypical: commercialOfficersTypicalByPort.get(p.portId) ?? null,
        sentriOfficersTypical: sentriOfficersTypicalByPort.get(p.portId) ?? null,
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
