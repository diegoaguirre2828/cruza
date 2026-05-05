import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// Returns average vehicle wait by hour-of-day using ALL available historical
// data for a single port (no date cutoff — more data = more accurate averages).
// Used by BridgeMomentChips carousel and the datos deep-stats chart.
export const revalidate = 600

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ portId: string }> }
) {
  const { portId } = await params
  const url = new URL(req.url)
  const dowParam = url.searchParams.get('dow')
  const todayDow = new Date().getDay()
  // dowFilter: when ?dow=N is passed, filter the DOW pattern to that weekday
  // (used by BridgeMomentChips to render "This Saturday" etc).
  // Defaults to todayDow so the legacy todayAvg field behavior is preserved.
  const dowFilter = dowParam != null && /^[0-6]$/.test(dowParam) ? Number(dowParam) : todayDow

  const { data, error } = await getSupabase()
    .from('wait_time_readings')
    .select('hour_of_day, day_of_week, vehicle_wait, recorded_at')
    .eq('port_id', portId)
    .not('vehicle_wait', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hourBuckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
  const todayBuckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
  let oldestDate: string | null = null

  for (const row of data || []) {
    if (row.vehicle_wait == null || row.hour_of_day == null) continue
    const h = row.hour_of_day as number
    const w = row.vehicle_wait as number
    hourBuckets[h].sum += w
    hourBuckets[h].count += 1
    if (row.day_of_week === dowFilter) {
      todayBuckets[h].sum += w
      todayBuckets[h].count += 1
    }
    if (row.recorded_at && (oldestDate == null || row.recorded_at < oldestDate)) {
      oldestDate = row.recorded_at as string
    }
  }

  // Compute how many weeks of data we have
  const weeksOfData = oldestDate
    ? Math.max(1, Math.round((Date.now() - new Date(oldestDate).getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : null

  const hours = hourBuckets.map((b, h) => ({
    hour: h,
    avgWait: b.count > 0 ? Math.round(b.sum / b.count) : null,
    todayAvg: todayBuckets[h].count > 0 ? Math.round(todayBuckets[h].sum / todayBuckets[h].count) : null,
    samples: b.count,
  }))

  const valid = hours.filter(h => h.avgWait != null) as { hour: number; avgWait: number }[]
  const peak = valid.length > 0 ? valid.reduce((a, b) => (b.avgWait > a.avgWait ? b : a)) : null
  const best = valid.length > 0 ? valid.reduce((a, b) => (b.avgWait < a.avgWait ? b : a)) : null

  const totalSamples = hourBuckets.reduce((s, b) => s + b.count, 0)
  return NextResponse.json(
    { hours, peak, best, totalSamples, weeksOfData },
    { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } }
  )
}
