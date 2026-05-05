import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// Returns average vehicle wait by hour-of-day using ALL available data.
// Delegates GROUP BY aggregation to Postgres via get_port_hourly_pattern()
// so only 168 rows (24h × 7 DOW) cross the wire instead of all raw readings.
export const revalidate = 600

interface AggRow {
  hour_of_day: number
  day_of_week: number
  avg_wait: number
  samples: number
  oldest_at: string | null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ portId: string }> },
) {
  const { portId } = await params
  const url = new URL(req.url)
  const dowParam = url.searchParams.get('dow')
  const todayDow = new Date().getDay()
  const dowFilter = dowParam != null && /^[0-6]$/.test(dowParam) ? Number(dowParam) : todayDow

  const { data, error } = await getSupabase()
    .rpc('get_port_hourly_pattern', { p_port_id: portId })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []) as AggRow[]

  // Reshape into per-hour buckets (all-DOW avg + DOW-specific avg)
  const hourBuckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
  const todayBuckets: { avg: number | null; samples: number }[] = Array.from({ length: 24 }, () => ({ avg: null, samples: 0 }))
  let oldestAt: string | null = null

  for (const row of rows) {
    const h = row.hour_of_day
    // All-DOW bucket: weighted accumulation so we can re-average across DOWs
    hourBuckets[h].sum += row.avg_wait * row.samples
    hourBuckets[h].count += Number(row.samples)

    if (row.day_of_week === dowFilter) {
      todayBuckets[h] = { avg: row.avg_wait, samples: Number(row.samples) }
    }

    if (row.oldest_at && (oldestAt == null || row.oldest_at < oldestAt)) {
      oldestAt = row.oldest_at
    }
  }

  const weeksOfData = oldestAt
    ? Math.max(1, Math.round((Date.now() - new Date(oldestAt).getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : null

  const hours = hourBuckets.map((b, h) => ({
    hour: h,
    avgWait: b.count > 0 ? Math.round(b.sum / b.count) : null,
    todayAvg: todayBuckets[h].avg,
    samples: b.count,
  }))

  const valid = hours.filter((h): h is typeof h & { avgWait: number } => h.avgWait !== null)
  const peak = valid.length > 0 ? valid.reduce((a, b) => (b.avgWait > a.avgWait ? b : a)) : null
  const best = valid.length > 0 ? valid.reduce((a, b) => (b.avgWait < a.avgWait ? b : a)) : null
  const totalSamples = hourBuckets.reduce((s, b) => s + b.count, 0)

  return NextResponse.json(
    { hours, peak, best, totalSamples, weeksOfData },
    { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } },
  )
}
