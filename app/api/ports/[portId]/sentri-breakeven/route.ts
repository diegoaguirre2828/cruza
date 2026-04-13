import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// SENTRI break-even analysis for a single port. Compares the average
// vehicle_wait against the average sentri_wait over the last 30 days
// (only when both were populated) to compute how many minutes SENTRI
// saves on average. Then uses the user's hourly-rate assumption ($40
// default) to dollarize that, and computes how many crossings it
// would take to pay back the $122.25 TTP SENTRI enrollment fee.
//
// Output: "SENTRI saves 47 min on average, worth ~$31 per crossing.
// Break-even at 4 uses." Sells both the SENTRI signup AND Cruzar's
// credibility as the trusted authority on when SENTRI is worth it.

export const revalidate = 3600 // 1h — historical averages change slowly

const SENTRI_FEE_USD = 122.25
const DEFAULT_HOURLY_RATE_USD = 40

interface Reading {
  vehicle_wait: number | null
  sentri_wait: number | null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ portId: string }> },
) {
  const { portId } = await params
  const url = new URL(req.url)
  const hourlyRate = Math.max(
    10,
    Math.min(200, Number(url.searchParams.get('hourlyRate') || DEFAULT_HOURLY_RATE_USD)),
  )

  const db = getServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await db
    .from('wait_time_readings')
    .select('vehicle_wait, sentri_wait')
    .eq('port_id', portId)
    .gte('recorded_at', since)
    .not('vehicle_wait', 'is', null)
    .not('sentri_wait', 'is', null)

  const readings = (data || []) as Reading[]
  const paired = readings.filter(
    (r) => r.vehicle_wait != null && r.sentri_wait != null,
  )

  if (paired.length < 10) {
    return NextResponse.json(
      {
        samples: paired.length,
        avgVehicleWait: null,
        avgSentriWait: null,
        avgSavingsMin: null,
        savingsUsdPerCrossing: null,
        breakEvenCrossings: null,
        hourlyRate,
        note: 'Not enough SENTRI data yet at this port.',
      },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' } },
    )
  }

  const avgVehicle =
    paired.reduce((s, r) => s + (r.vehicle_wait || 0), 0) / paired.length
  const avgSentri =
    paired.reduce((s, r) => s + (r.sentri_wait || 0), 0) / paired.length
  const avgSavingsMin = Math.max(0, avgVehicle - avgSentri)
  const savingsHours = avgSavingsMin / 60
  const savingsUsdPerCrossing = savingsHours * hourlyRate
  const breakEvenCrossings =
    savingsUsdPerCrossing > 0 ? Math.ceil(SENTRI_FEE_USD / savingsUsdPerCrossing) : null

  return NextResponse.json(
    {
      samples: paired.length,
      avgVehicleWait: Math.round(avgVehicle),
      avgSentriWait: Math.round(avgSentri),
      avgSavingsMin: Math.round(avgSavingsMin),
      savingsUsdPerCrossing: Math.round(savingsUsdPerCrossing * 100) / 100,
      breakEvenCrossings,
      hourlyRate,
      sentriFeeUsd: SENTRI_FEE_USD,
    },
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' } },
  )
}
