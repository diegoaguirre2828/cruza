import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

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
  if (!['business'].includes(profile?.tier || '')) {
    return NextResponse.json({ error: 'Business plan required' }, { status: 403 })
  }

  const portId = req.nextUrl.searchParams.get('portId')
  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') || '30'), 90)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = db
    .from('wait_time_readings')
    .select('port_id, port_name, crossing_name, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, recorded_at, day_of_week, hour_of_day')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })
    .limit(10000)

  if (portId) query = query.eq('port_id', portId)

  const { data: rows } = await query

  if (!rows?.length) return new NextResponse('No data', { status: 404 })

  const headers = ['recorded_at', 'port_id', 'port_name', 'crossing_name', 'vehicle_wait', 'sentri_wait', 'pedestrian_wait', 'commercial_wait', 'day_of_week', 'hour_of_day']
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = r[h as keyof typeof r]
      return val === null || val === undefined ? '' : String(val)
    }).join(','))
  ].join('\n')

  const filename = portId
    ? `cruzar-${portId}-${days}d.csv`
    : `cruzar-all-crossings-${days}d.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
