import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Accident impact model for a single port. Cross-references accident /
// inspection / officer_k9 reports in crossing_reports against the
// wait_time_readings that surround them, and computes the average
// wait-time delta in the 90 minutes AFTER each incident vs the 30
// minutes BEFORE. Output: "when an accident is reported, wait
// typically jumps +X min and stays elevated for Y min."
//
// Pure aggregation over data we already capture — no schema change.
// This is one of the data goldmines nobody else at the border has.

export const revalidate = 900 // 15 min

const IMPACT_REPORT_TYPES = ['accident', 'inspection', 'officer_k9', 'officer_secondary', 'road_hazard']

interface Reading {
  recorded_at: string
  vehicle_wait: number | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portId: string }> },
) {
  const { portId } = await params
  const db = getServiceClient()

  // Pull incidents from the last 60 days at this port
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data: incidents } = await db
    .from('crossing_reports')
    .select('report_type, created_at')
    .eq('port_id', portId)
    .in('report_type', IMPACT_REPORT_TYPES)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!incidents || incidents.length === 0) {
    return NextResponse.json(
      { samples: 0, avgJumpMin: null, avgRecoveryMin: null, byType: {} },
      { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } },
    )
  }

  // Pull the relevant readings — broad window covering all incidents
  const earliestIncident = incidents[incidents.length - 1].created_at
  const readingsSince = new Date(
    new Date(earliestIncident).getTime() - 60 * 60 * 1000, // 1h before earliest
  ).toISOString()
  const { data: readings } = await db
    .from('wait_time_readings')
    .select('recorded_at, vehicle_wait')
    .eq('port_id', portId)
    .gte('recorded_at', readingsSince)
    .order('recorded_at', { ascending: true })
  const allReadings = (readings || []) as Reading[]

  // For each incident, compute the before/after delta.
  // Before: average vehicle_wait in the 30 min BEFORE the incident
  // After:  max vehicle_wait in the 90 min AFTER the incident
  // Recovery: minutes until wait returns to within 15% of the before avg
  const jumps: number[] = []
  const recoveries: number[] = []
  const byType: Record<string, { samples: number; avgJumpMin: number }> = {}

  for (const inc of incidents) {
    const t = new Date(inc.created_at).getTime()
    const before = allReadings.filter((r) => {
      const rt = new Date(r.recorded_at).getTime()
      return rt >= t - 30 * 60 * 1000 && rt < t && r.vehicle_wait != null
    })
    const after = allReadings.filter((r) => {
      const rt = new Date(r.recorded_at).getTime()
      return rt > t && rt <= t + 90 * 60 * 1000 && r.vehicle_wait != null
    })
    if (before.length === 0 || after.length === 0) continue

    const beforeAvg = before.reduce((s, r) => s + (r.vehicle_wait || 0), 0) / before.length
    const afterMax = Math.max(...after.map((r) => r.vehicle_wait || 0))
    const jump = Math.max(0, afterMax - beforeAvg)
    jumps.push(jump)

    // Recovery: first point after the peak where wait <= beforeAvg * 1.15
    const threshold = beforeAvg * 1.15
    const peakReading = after.find((r) => r.vehicle_wait === afterMax)
    if (peakReading) {
      const peakTime = new Date(peakReading.recorded_at).getTime()
      const recovery = allReadings.find((r) => {
        const rt = new Date(r.recorded_at).getTime()
        return rt > peakTime && (r.vehicle_wait ?? 9999) <= threshold
      })
      if (recovery) {
        const mins = (new Date(recovery.recorded_at).getTime() - t) / 60000
        if (mins > 0 && mins < 240) recoveries.push(mins)
      }
    }

    // Per-type tally
    const key = inc.report_type || 'other'
    if (!byType[key]) byType[key] = { samples: 0, avgJumpMin: 0 }
    byType[key].samples++
    byType[key].avgJumpMin =
      (byType[key].avgJumpMin * (byType[key].samples - 1) + jump) / byType[key].samples
  }

  const avgJumpMin =
    jumps.length > 0 ? Math.round(jumps.reduce((s, j) => s + j, 0) / jumps.length) : null
  const avgRecoveryMin =
    recoveries.length > 0
      ? Math.round(recoveries.reduce((s, r) => s + r, 0) / recoveries.length)
      : null

  return NextResponse.json(
    {
      samples: jumps.length,
      avgJumpMin,
      avgRecoveryMin,
      byType: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, { samples: v.samples, avgJumpMin: Math.round(v.avgJumpMin) }]),
      ),
    },
    { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } },
  )
}
