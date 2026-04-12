import { NextRequest, NextResponse } from 'next/server'
import { fetchRgvWaitTimes, portUtcOffsetHours } from '@/lib/cbp'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ports = await fetchRgvWaitTimes()
    const supabase = getServiceClient()
    const now = new Date()

    const rows = ports.map((p) => {
      // day_of_week / hour_of_day must be in the port's LOCAL time, not UTC.
      // A Sunday 11pm reading in RGV = Monday 4am UTC — stored as Monday
      // would contaminate the "best time to cross" historical queries.
      const offsetHours = portUtcOffsetHours(p.portName)
      const portLocal = new Date(now.getTime() + offsetHours * 60 * 60 * 1000)
      return {
        port_id: p.portId,
        port_name: p.portName,
        crossing_name: p.crossingName,
        vehicle_wait: p.vehicle,
        sentri_wait: p.sentri,
        pedestrian_wait: p.pedestrian,
        commercial_wait: p.commercial,
        recorded_at: now.toISOString(),
        day_of_week: portLocal.getUTCDay(),
        hour_of_day: portLocal.getUTCHours(),
      }
    })

    const { error } = await supabase.from('wait_time_readings').insert(rows)
    if (error) throw error

    return NextResponse.json({ saved: rows.length, at: now.toISOString() })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
