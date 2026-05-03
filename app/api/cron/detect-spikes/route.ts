import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getPortMeta } from "@/lib/portMeta"
import {
  evaluateSpike,
  medianWait,
  LANE_COLUMN,
  type Lane,
  type Severity,
} from "@/lib/spikeDetector"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Every 15 minutes, scan the most recent reading per port per lane, compare
 * against the same-day-of-week-same-hour historical median, and insert any
 * detected spikes into `port_spikes`. De-duped: a spike row is NOT inserted
 * if one already exists for this port+lane in the last 2 hours.
 *
 * Auth: CRON_SECRET via `?secret=` or `Authorization: Bearer`.
 * Intended caller: cron-job.org, every 15 min.
 */

const LANES: Lane[] = ["vehicle", "sentri", "commercial"] // skip pedestrian — rarely newsworthy
const DEDUPE_WINDOW_HOURS = 2
const HISTORY_WEEKS = 8

type CronResult = {
  ok: boolean
  scanned: number
  spikesDetected: number
  spikesInserted: number
  errors: string[]
}

function isAuthed(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret")
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return secret === cronSecret || authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const result: CronResult = {
    ok: true,
    scanned: 0,
    spikesDetected: 0,
    spikesInserted: 0,
    errors: [],
  }

  // 1. Pull the most recent reading per port in the last 30 min.
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: recentRows, error: recentErr } = await supabase
    .from("wait_time_readings")
    .select(
      "port_id, port_name, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, recorded_at, day_of_week, hour_of_day"
    )
    .gte("recorded_at", thirtyMinAgo)
    .order("recorded_at", { ascending: false })
    .limit(500)

  if (recentErr) {
    return NextResponse.json({ ...result, ok: false, errors: [recentErr.message] }, { status: 500 })
  }

  // Keep the latest row per port_id only.
  const latestByPort = new Map<string, NonNullable<typeof recentRows>[number]>()
  for (const row of recentRows ?? []) {
    if (!latestByPort.has(row.port_id)) latestByPort.set(row.port_id, row)
  }
  result.scanned = latestByPort.size

  // 2. For each port × lane, fetch ~8 weeks of same-dow-same-hour samples and compare.
  for (const [portId, reading] of latestByPort) {
    const portMeta = getPortMeta(portId)
    const portName = reading.port_name ?? portMeta?.localName ?? portMeta?.city ?? portId
    const region = portMeta?.megaRegion ?? null

    for (const lane of LANES) {
      const laneCol = LANE_COLUMN[lane]
      const currentWait = reading[laneCol as keyof typeof reading] as number | null
      if (currentWait === null || currentWait === undefined || currentWait <= 0) continue

      // Fetch historical samples for (port_id, day_of_week, hour_of_day) covering last ~HISTORY_WEEKS weeks.
      const windowStart = new Date(
        Date.now() - HISTORY_WEEKS * 7 * 24 * 60 * 60 * 1000
      ).toISOString()
      const { data: history, error: histErr } = await supabase
        .from("wait_time_readings")
        .select(laneCol)
        .eq("port_id", portId)
        .eq("day_of_week", reading.day_of_week)
        .eq("hour_of_day", reading.hour_of_day)
        .gte("recorded_at", windowStart)
        .limit(400)

      if (histErr) {
        result.errors.push(`history ${portId}/${lane}: ${histErr.message}`)
        continue
      }

      const samples = (history ?? []).map(
        (r) => (r as unknown as Record<string, unknown>)[laneCol] as number | null
      )
      const baseline = medianWait(samples)
      const spike = evaluateSpike({ currentWait, baselineWait: baseline })
      if (!spike.isSpike) continue
      result.spikesDetected++

      // 3. Dedupe against recent spikes for same port+lane.
      const dedupeSince = new Date(
        Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString()
      const { data: recentSpikes } = await supabase
        .from("port_spikes")
        .select("id")
        .eq("port_id", portId)
        .eq("lane", lane)
        .gte("detected_at", dedupeSince)
        .limit(1)

      if (recentSpikes && recentSpikes.length > 0) continue // already flagged

      const { error: insertErr } = await supabase.from("port_spikes").insert({
        port_id: portId,
        port_name: portName,
        region,
        lane,
        current_wait: currentWait,
        baseline_wait: baseline!,
        delta_minutes: spike.deltaMinutes,
        delta_pct: spike.deltaPct,
        severity: spike.severity as Severity,
        reading_recorded_at: reading.recorded_at,
      })
      if (insertErr) {
        result.errors.push(`insert ${portId}/${lane}: ${insertErr.message}`)
        continue
      }
      result.spikesInserted++
    }
  }

  result.ok = result.errors.length === 0
  return NextResponse.json(result)
}
