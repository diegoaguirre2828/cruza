import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// Forecast endpoint powering the new port detail card rail
// (Border Times-style) AND the Tier 2 home forecast card.
//
// Single payload so /port/[id] fetches once and renders:
//   - bestHour    — the lowest-wait hour of the day, historically
//   - rushHour    — the highest-wait hour
//   - todayPattern— hourly averages for THIS day-of-week (last 5 weeks)
//   - forecast    — NOW + 1h + 2h + 3h + 4h predicted waits
//
// All from wait_time_readings (CBP rollup cron writes here every
// 15 min). Filters to the requested lane_type if specified via the
// `lane` query param (default: all/standard).
//
// NOTE: wait_time_readings stores vehicle_wait (standard), sentri_wait,
// pedestrian_wait, commercial_wait as separate columns. So "lane"
// just picks which column to aggregate.

type LaneParam = 'standard' | 'sentri' | 'pedestrian' | 'commercial'
const LANE_TO_COLUMN: Record<LaneParam, 'vehicle_wait' | 'sentri_wait' | 'pedestrian_wait' | 'commercial_wait'> = {
  standard: 'vehicle_wait',
  sentri: 'sentri_wait',
  pedestrian: 'pedestrian_wait',
  commercial: 'commercial_wait',
}

interface ForecastRow {
  hour: number
  avgWait: number | null
  samples: number
}

interface ForecastResponse {
  portId: string
  lane: LaneParam
  generatedAt: string
  bestHour: { hour: number; avgWait: number } | null
  rushHour: { hour: number; avgWait: number } | null
  todayPattern: ForecastRow[] // 24 entries, one per hour
  forecast: Array<{ hour: number; avgWait: number | null; delta: string }> // NOW + 4 forward hours
  dayOfWeek: number
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ portId: string }> },
) {
  const { portId } = await params
  const laneParam = (req.nextUrl.searchParams.get('lane') || 'standard') as LaneParam
  const lane: LaneParam = ['standard', 'sentri', 'pedestrian', 'commercial'].includes(laneParam)
    ? laneParam
    : 'standard'
  const column = LANE_TO_COLUMN[lane]

  const db = getServiceClient()
  const now = new Date()
  const currentDow = now.getDay() // 0=Sunday..6=Saturday
  const currentHourUtc = now.getUTCHours()

  // Pull last 30 days of readings for this port so we can do all the
  // rollups in one query. ~30*96 = 2880 rows max, well within limits.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from('wait_time_readings')
    .select(`hour_of_day, day_of_week, ${column}`)
    .eq('port_id', portId)
    .gte('recorded_at', thirtyDaysAgo)
    .not(column, 'is', null)
    .limit(5000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data || []) as Array<{ hour_of_day: number; day_of_week: number } & Record<string, number | null>>

  // ─── Overall best + rush hour (across all days) ───
  const hourBucketsAll: number[][] = Array.from({ length: 24 }, () => [])
  for (const r of rows) {
    const w = r[column]
    if (typeof w === 'number' && w >= 0) hourBucketsAll[r.hour_of_day].push(w)
  }
  const hourlyAvgAll = hourBucketsAll.map((arr, h) => ({
    hour: h,
    avgWait: arr.length > 0 ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null,
    samples: arr.length,
  }))
  const validAll = hourlyAvgAll.filter((h): h is { hour: number; avgWait: number; samples: number } =>
    h.avgWait !== null && h.samples >= 2,
  )
  const bestHour = validAll.length > 0
    ? validAll.reduce((a, b) => (b.avgWait < a.avgWait ? b : a))
    : null
  const rushHour = validAll.length > 0
    ? validAll.reduce((a, b) => (b.avgWait > a.avgWait ? b : a))
    : null

  // ─── Today's pattern (scoped to current day-of-week) ───
  const hourBucketsDow: number[][] = Array.from({ length: 24 }, () => [])
  for (const r of rows) {
    if (r.day_of_week !== currentDow) continue
    const w = r[column]
    if (typeof w === 'number' && w >= 0) hourBucketsDow[r.hour_of_day].push(w)
  }
  const todayPattern: ForecastRow[] = hourBucketsDow.map((arr, h) => ({
    hour: h,
    avgWait: arr.length > 0 ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null,
    samples: arr.length,
  }))

  // ─── Forward forecast: NOW + 1h + 2h + 3h + 4h ───
  // Prefer today's pattern if we have ≥2 samples for that hour;
  // otherwise fall back to the overall hourly average.
  const forecast: ForecastResponse['forecast'] = []
  for (let offset = 0; offset <= 4; offset++) {
    const hour = (currentHourUtc + offset) % 24
    const dow = todayPattern[hour]
    const all = hourlyAvgAll[hour]
    let avgWait: number | null = null
    if (dow.samples >= 2 && dow.avgWait != null) avgWait = dow.avgWait
    else if (all.avgWait != null) avgWait = all.avgWait
    forecast.push({
      hour,
      avgWait,
      delta: offset === 0 ? 'NOW' : `+${offset}H`,
    })
  }

  const response: ForecastResponse = {
    portId,
    lane,
    generatedAt: now.toISOString(),
    bestHour: bestHour ? { hour: bestHour.hour, avgWait: bestHour.avgWait } : null,
    rushHour: rushHour ? { hour: rushHour.hour, avgWait: rushHour.avgWait } : null,
    todayPattern,
    forecast,
    dayOfWeek: currentDow,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
  })
}
