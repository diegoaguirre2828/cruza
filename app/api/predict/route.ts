import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Returns best times for multiple ports on a specific day of week
// Used by the scheduling planner
export async function GET(req: NextRequest) {
  const portIds = req.nextUrl.searchParams.get('portIds')?.split(',').filter(Boolean)
  const targetDay = req.nextUrl.searchParams.get('day') // 0-6, Sunday=0
  const targetHour = req.nextUrl.searchParams.get('hour') // specific hour, or null for full day

  if (!portIds || portIds.length === 0) {
    return NextResponse.json({ error: 'portIds required' }, { status: 400 })
  }

  const db = getServiceClient()
  const dayNum = targetDay !== null ? parseInt(targetDay) : null

  let query = db
    .from('wait_time_readings')
    .select('port_id, day_of_week, hour_of_day, vehicle_wait, commercial_wait')
    .in('port_id', portIds)

  if (dayNum !== null) query = query.eq('day_of_week', dayNum)
  if (targetHour !== null) query = query.eq('hour_of_day', parseInt(targetHour))

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ results: {}, hasData: false })
  }

  // Build per-port, per-day, per-hour averages
  type HourStats = { vehicleWaits: number[]; commercialWaits: number[] }
  const map: Record<string, Record<string, Record<number, HourStats>>> = {}

  for (const row of data) {
    if (!map[row.port_id]) map[row.port_id] = {}
    const dayKey = String(row.day_of_week)
    if (!map[row.port_id][dayKey]) map[row.port_id][dayKey] = {}
    if (!map[row.port_id][dayKey][row.hour_of_day]) {
      map[row.port_id][dayKey][row.hour_of_day] = { vehicleWaits: [], commercialWaits: [] }
    }
    if (row.vehicle_wait !== null) map[row.port_id][dayKey][row.hour_of_day].vehicleWaits.push(row.vehicle_wait)
    if (row.commercial_wait !== null) map[row.port_id][dayKey][row.hour_of_day].commercialWaits.push(row.commercial_wait)
  }

  function avg(arr: number[]): number | null {
    if (!arr.length) return null
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  }

  // For each port, compute best hours per day
  const results: Record<string, {
    dayAverages: Array<{
      day: number
      hour: number
      vehicleAvg: number | null
      commercialAvg: number | null
      samples: number
    }>
    bestHour: { day: number; hour: number; vehicleAvg: number; samples: number } | null
    weekHeatmap: Array<{ day: number; hour: number; level: 'low' | 'medium' | 'high' | 'none' }>
  }> = {}

  for (const portId of portIds) {
    const portMap = map[portId] || {}
    const dayAverages: typeof results[string]['dayAverages'] = []
    const weekHeatmap: typeof results[string]['weekHeatmap'] = []

    for (const [dayKey, hours] of Object.entries(portMap)) {
      for (const [hourKey, stats] of Object.entries(hours)) {
        const vAvg = avg(stats.vehicleWaits)
        const cAvg = avg(stats.commercialWaits)
        const samples = Math.max(stats.vehicleWaits.length, stats.commercialWaits.length)
        dayAverages.push({ day: parseInt(dayKey), hour: parseInt(hourKey), vehicleAvg: vAvg, commercialAvg: cAvg, samples })

        const wait = vAvg ?? 999
        const level: 'low' | 'medium' | 'high' | 'none' = vAvg === null ? 'none' : wait < 20 ? 'low' : wait < 45 ? 'medium' : 'high'
        weekHeatmap.push({ day: parseInt(dayKey), hour: parseInt(hourKey), level })
      }
    }

    const best = dayAverages
      .filter(d => d.vehicleAvg !== null && d.samples >= 2)
      .sort((a, b) => (a.vehicleAvg ?? 999) - (b.vehicleAvg ?? 999))[0]

    results[portId] = {
      dayAverages: dayAverages.sort((a, b) => a.day - b.day || a.hour - b.hour),
      bestHour: best ? { day: best.day, hour: best.hour, vehicleAvg: best.vehicleAvg!, samples: best.samples } : null,
      weekHeatmap,
    }
  }

  return NextResponse.json({ results, hasData: true })
}
