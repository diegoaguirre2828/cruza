import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Aggregated lane-level community report stats for a single port.
// Reads every crossing_report in the last 30 days that has
// source_meta.lane_info populated and tallies:
//   - how often each slow_lane type was flagged (con_rayos / sin_rayos / sentri / parejo)
//   - average lanes_open
//   - average lanes_xray
//   - sample count
//
// This is the Enrique-feature payoff. CBP publishes one wait number
// per bridge, but the lane-level granularity ("which specific lane
// is slow, which have X-ray") is the thing locals actually make
// decisions on. With 30 days of community submissions this endpoint
// can tell you "at Hidalgo, the sin-rayos lane is marked slowest
// 68% of the time."

export const revalidate = 1800 // 30 min

interface Row {
  source_meta: {
    lane_info?: {
      lanes_open?: number | null
      lanes_xray?: number | null
      slow_lane?: string | null
    }
  } | null
  created_at: string
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portId: string }> },
) {
  const { portId } = await params
  const db = getServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('crossing_reports')
    .select('source_meta, created_at')
    .eq('port_id', portId)
    .gte('created_at', since)
    .not('source_meta', 'is', null)
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []) as Row[]

  const slowLaneCounts: Record<string, number> = {
    con_rayos: 0, sin_rayos: 0, sentri: 0, parejo: 0,
  }
  let lanesOpenSum = 0, lanesOpenCount = 0
  let lanesXraySum = 0, lanesXrayCount = 0
  let samples = 0
  let mostRecent: string | null = null

  for (const r of rows) {
    const li = r.source_meta?.lane_info
    if (!li) continue
    samples++
    if (!mostRecent || r.created_at > mostRecent) mostRecent = r.created_at
    if (typeof li.slow_lane === 'string' && li.slow_lane in slowLaneCounts) {
      slowLaneCounts[li.slow_lane]++
    }
    if (typeof li.lanes_open === 'number') {
      lanesOpenSum += li.lanes_open
      lanesOpenCount++
    }
    if (typeof li.lanes_xray === 'number') {
      lanesXraySum += li.lanes_xray
      lanesXrayCount++
    }
  }

  const slowLaneTotal = Object.values(slowLaneCounts).reduce((s, n) => s + n, 0)
  const slowLanePct: Record<string, number> = {}
  for (const [k, v] of Object.entries(slowLaneCounts)) {
    slowLanePct[k] = slowLaneTotal > 0 ? Math.round((v / slowLaneTotal) * 100) : 0
  }

  const avgLanesOpen = lanesOpenCount > 0 ? Math.round((lanesOpenSum / lanesOpenCount) * 10) / 10 : null
  const avgLanesXray = lanesXrayCount > 0 ? Math.round((lanesXraySum / lanesXrayCount) * 10) / 10 : null

  return NextResponse.json(
    {
      samples,
      slowLaneCounts,
      slowLanePct,
      avgLanesOpen,
      avgLanesXray,
      mostRecent,
    },
    { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } },
  )
}
