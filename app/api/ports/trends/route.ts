import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Direction = 'up' | 'down' | 'stable'

function direction(curr: number | null, prev: number | null): Direction {
  if (curr === null || prev === null) return 'stable'
  if (curr - prev >= 5) return 'up'
  if (prev - curr >= 5) return 'down'
  return 'stable'
}

export async function GET() {
  const since = new Date(Date.now() - 45 * 60 * 1000).toISOString()

  const { data } = await getSupabase()
    .from('wait_time_readings')
    .select('port_id, vehicle_wait, commercial_wait, recorded_at')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })

  if (!data?.length) return NextResponse.json({ trends: {} })

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
  const latest: Record<string, typeof data[0]> = {}
  const older: Record<string, typeof data[0]> = {}

  for (const r of data) {
    if (!latest[r.port_id]) {
      latest[r.port_id] = r
    } else if (!older[r.port_id] && new Date(r.recorded_at) <= thirtyMinAgo) {
      older[r.port_id] = r
    }
  }

  const trends: Record<string, { vehicle: Direction; commercial: Direction }> = {}
  for (const portId of Object.keys(latest)) {
    const curr = latest[portId]
    const prev = older[portId]
    if (!prev) {
      trends[portId] = { vehicle: 'stable', commercial: 'stable' }
    } else {
      trends[portId] = {
        vehicle: direction(curr.vehicle_wait, prev.vehicle_wait),
        commercial: direction(curr.commercial_wait, prev.commercial_wait),
      }
    }
  }

  return NextResponse.json({ trends })
}
