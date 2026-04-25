import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// PERF (2026-04-25 audit): leaderboard updates only on report submits;
// 5 min staleness is acceptable. The Cache-Control header on the
// response already says public, s-maxage=300; remove force-dynamic so
// the edge can actually honour it.
export const revalidate = 300

export async function GET() {
  const db = getServiceClient()

  // SECURITY (2026-04-25 audit): do NOT return profiles.id (auth.users
  // UUID) on this public endpoint. UUIDs combined with referral / circle-
  // invite endpoints that take user_id as a body field create silent
  // attribution-griefing + future authz footguns. We still need a
  // stable per-row key for React + a 4-char disambiguator for users
  // who haven't set a display_name, so we expose `id_suffix` (first 4
  // chars of the dash-stripped UUID) — a 16^4 = 65k-bucket pseudonym
  // that can't be reversed to the full UUID.
  const { data, error } = await db
    .from('profiles')
    .select('id, display_name, points, reports_count, badges')
    .order('points', { ascending: false })
    .limit(50)

  const sanitized = (data || []).map((row) => {
    const fullId: string = row.id || ''
    const idSuffix = fullId.replace(/-/g, '').slice(0, 4)
    return {
      id_suffix: idSuffix,
      display_name: row.display_name,
      points: row.points,
      reports_count: row.reports_count,
      badges: row.badges,
    }
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { leaders: sanitized },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  )
}
