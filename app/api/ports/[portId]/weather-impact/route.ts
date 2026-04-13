import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Weather-vs-wait correlation for a single port. Reads the last 30
// days of wait_time_readings (with the weather columns added in
// schema-v24) and computes avg vehicle_wait bucketed by
// weather_condition. Output: "clear: 18 min, rain: 34 min,
// fog: 41 min" — the "rain adds X min at Hidalgo" goldmine.
//
// Requires schema-v24 to have been run and enough cron cycles to
// have accumulated weather-tagged readings. Endpoint returns
// empty gracefully when data is sparse so the widget can display
// a "need more data" state.

export const revalidate = 1800

interface Row {
  vehicle_wait: number | null
  weather_condition: string | null
}

const CONDITION_LABEL: Record<string, { emoji: string; es: string; en: string }> = {
  clear:          { emoji: '☀️', es: 'Despejado',        en: 'Clear' },
  partly_cloudy:  { emoji: '⛅', es: 'Parcialmente nublado', en: 'Partly cloudy' },
  fog:            { emoji: '🌫️', es: 'Neblina',          en: 'Fog' },
  drizzle:        { emoji: '🌦️', es: 'Llovizna',         en: 'Drizzle' },
  rain:           { emoji: '🌧️', es: 'Lluvia',           en: 'Rain' },
  rain_showers:   { emoji: '🌧️', es: 'Aguaceros',        en: 'Rain showers' },
  snow:           { emoji: '❄️', es: 'Nieve',            en: 'Snow' },
  snow_showers:   { emoji: '❄️', es: 'Nevada ligera',    en: 'Snow showers' },
  thunderstorm:   { emoji: '⛈️', es: 'Tormenta',         en: 'Thunderstorm' },
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portId: string }> },
) {
  const { portId } = await params
  const db = getServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('wait_time_readings')
    .select('vehicle_wait, weather_condition')
    .eq('port_id', portId)
    .gte('recorded_at', since)
    .not('vehicle_wait', 'is', null)
    .not('weather_condition', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []) as Row[]

  // Bucket + avg per condition
  const byCondition = new Map<string, { sum: number; count: number }>()
  for (const r of rows) {
    if (r.vehicle_wait == null || !r.weather_condition) continue
    const bucket = byCondition.get(r.weather_condition) || { sum: 0, count: 0 }
    bucket.sum += r.vehicle_wait
    bucket.count += 1
    byCondition.set(r.weather_condition, bucket)
  }

  const conditions = Array.from(byCondition.entries())
    .filter(([, v]) => v.count >= 5) // at least 5 readings per bucket to be meaningful
    .map(([key, v]) => ({
      key,
      label: CONDITION_LABEL[key] || { emoji: '❓', es: key, en: key },
      avgWaitMin: Math.round(v.sum / v.count),
      samples: v.count,
    }))
    .sort((a, b) => a.avgWaitMin - b.avgWaitMin)

  // Compute the "baseline" as the clear/partly_cloudy average so
  // we can express other conditions as a delta ("rain = +18 min").
  const baseline =
    conditions.find((c) => c.key === 'clear') ||
    conditions.find((c) => c.key === 'partly_cloudy') ||
    conditions[0]

  const withDelta = conditions.map((c) => ({
    ...c,
    deltaVsBaselineMin: baseline ? c.avgWaitMin - baseline.avgWaitMin : 0,
  }))

  return NextResponse.json(
    {
      samples: rows.length,
      baselineCondition: baseline?.key || null,
      baselineWaitMin: baseline?.avgWaitMin ?? null,
      conditions: withDelta,
    },
    { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } },
  )
}
