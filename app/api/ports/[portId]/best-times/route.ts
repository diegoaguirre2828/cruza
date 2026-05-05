import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// Uses get_port_hourly_pattern() SQL aggregation — filters to today's DOW
// from 168 pre-averaged rows instead of fetching all raw readings into JS.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portId: string }> }
) {
  const { portId } = await params
  const dayOfWeek = new Date().getDay()

  const { data, error } = await getSupabase()
    .rpc('get_port_hourly_pattern', { p_port_id: portId })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const todayRows = (data || []).filter((r: { day_of_week: number }) => r.day_of_week === dayOfWeek)

  if (todayRows.length === 0) return NextResponse.json({ bestTimes: [] })

  const averages = todayRows
    .map((r: { hour_of_day: number; avg_wait: number; samples: number }) => ({
      hour: r.hour_of_day,
      avgWait: r.avg_wait,
      samples: Number(r.samples),
    }))
    .sort((a: { avgWait: number }, b: { avgWait: number }) => a.avgWait - b.avgWait)

  return NextResponse.json({ bestTimes: averages.slice(0, 5) })
}
