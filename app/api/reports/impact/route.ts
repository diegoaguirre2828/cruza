import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Impact endpoint for the post-report "Gracias, guardián" moment.
//
// Returns the two honest numbers that make a community submission feel
// meaningful instead of abstract:
//   - `subscribers`: count of active alert_preferences subscribers on
//     this port. These are real people who asked to be notified about
//     this crossing. Every report informs them.
//   - `guardiansToday`: unique user_ids that submitted at least one
//     report across the whole network today. The "cuántos guardianes
//     hoy" count the post-report screen shows.
//
// Intentionally unauthenticated — this is feel-good social proof, not
// sensitive data.

export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  if (!portId) {
    return NextResponse.json({ error: 'portId required' }, { status: 400 })
  }

  const db = getServiceClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [subsRes, reportersRes] = await Promise.all([
    db
      .from('alert_preferences')
      .select('id', { count: 'exact', head: true })
      .eq('port_id', portId)
      .eq('active', true),
    db
      .from('crossing_reports')
      .select('user_id')
      .gte('created_at', todayStart.toISOString())
      .not('user_id', 'is', null),
  ])

  const subscribers = subsRes.count ?? 0
  const uniqueReporters = new Set(
    (reportersRes.data || []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean),
  )
  const guardiansToday = uniqueReporters.size

  return NextResponse.json(
    { subscribers, guardiansToday },
    {
      headers: {
        // This number is stable within a minute — cheap caching is fine.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
      },
    },
  )
}
