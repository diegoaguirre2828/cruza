import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// Uses get_port_hourly_pattern() SQL aggregation — returns 168 pre-averaged
// rows (24h × 7 DOW) instead of fetching all raw readings into JS.
export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })

  const { data, error } = await getSupabase()
    .rpc('get_port_hourly_pattern', { p_port_id: portId })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length < 10) {
    return NextResponse.json({ predictions: [], message: 'Not enough data yet' })
  }

  // Build DOW+hour lookup from pre-aggregated rows
  const map: Record<string, { avg: number; samples: number }> = {}
  for (const row of data) {
    map[`${row.day_of_week}-${row.hour_of_day}`] = {
      avg: row.avg_wait,
      samples: Number(row.samples),
    }
  }

  // Generate next 24 hours of predictions
  const now = new Date()
  const predictions = []

  for (let i = 0; i < 24; i++) {
    const future = new Date(now.getTime() + i * 60 * 60 * 1000)
    const day = future.getDay()
    const hour = future.getHours()
    const entry = map[`${day}-${hour}`]

    if (entry && entry.samples > 0) {
      predictions.push({
        datetime: future.toISOString(),
        hour,
        day,
        predictedWait: entry.avg,
        confidence: entry.samples >= 40 ? 'high' : entry.samples >= 20 ? 'medium' : 'low',
        samples: entry.samples,
      })
    } else {
      predictions.push({
        datetime: future.toISOString(),
        hour,
        day,
        predictedWait: null,
        confidence: 'none',
        samples: 0,
      })
    }
  }

  const best = predictions
    .filter(p => p.predictedWait !== null && p.confidence !== 'none')
    .sort((a, b) => (a.predictedWait ?? 999) - (b.predictedWait ?? 999))
    .slice(0, 3)

  return NextResponse.json({ predictions, best })
}
