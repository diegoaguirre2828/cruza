import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// GET /api/business/delay-cost
// Returns the dispatcher's dollar cost of border delays for the current
// period (default: this_week, also supports this_month). Used by the
// Business dashboard headline card and the weekly delay email.
//
// Cost formula: delay_minutes × ($HOURLY / 60)
// Hourly default = $85 (trucking-industry border-delay loss, conservative)

export const dynamic = 'force-dynamic'

const DEFAULT_HOURLY = 85

function periodStart(period: string): string {
  const now = new Date()
  const d = new Date(now)
  if (period === 'this_month') {
    d.setUTCDate(1)
  } else {
    // this_week — Monday 00:00 UTC
    const day = d.getUTCDay()
    const diff = (day === 0 ? 6 : day - 1)
    d.setUTCDate(d.getUTCDate() - diff)
  }
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: profile } = await db.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'business') {
    return NextResponse.json({ error: 'Business plan required' }, { status: 403 })
  }

  const period = req.nextUrl.searchParams.get('period') === 'this_month' ? 'this_month' : 'this_week'
  const hourly = Number(req.nextUrl.searchParams.get('hourly')) || DEFAULT_HOURLY
  const since = periodStart(period)

  const { data: shipments } = await db
    .from('shipments')
    .select('id, reference_id, port_id, delay_minutes, actual_crossing_at, updated_at, status')
    .eq('user_id', user.id)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })

  const rows = shipments ?? []
  let totalMinutes = 0
  let delayedCount = 0
  const perPort: Record<string, { minutes: number; count: number }> = {}

  for (const s of rows) {
    const m = s.delay_minutes ?? 0
    if (m > 0) {
      totalMinutes += m
      delayedCount++
      const key = s.port_id || 'unknown'
      if (!perPort[key]) perPort[key] = { minutes: 0, count: 0 }
      perPort[key].minutes += m
      perPort[key].count++
    }
  }

  const totalCost = Math.round((totalMinutes / 60) * hourly)
  const byPort = Object.entries(perPort)
    .map(([portId, v]) => ({
      port_id: portId,
      minutes: v.minutes,
      count: v.count,
      cost: Math.round((v.minutes / 60) * hourly),
    }))
    .sort((a, b) => b.cost - a.cost)

  return NextResponse.json({
    period,
    since,
    hourly,
    total_cost: totalCost,
    total_minutes: totalMinutes,
    delayed_shipments: delayedCount,
    total_shipments: rows.length,
    by_port: byPort,
  })
}
