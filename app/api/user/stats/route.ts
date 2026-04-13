import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Per-user contribution stats for the Guardián progress card.
// Returns the current week's report count, today's count, and a simple
// "rank" based on how many reporters the user is ahead of in the last
// 7 days. Kept in one endpoint to avoid 3 round-trips on the homepage.

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  weekStart.setHours(0, 0, 0, 0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Pull this user's reports this week.
  const { data: myReports } = await db
    .from('crossing_reports')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', weekStart.toISOString())

  const weekCount = myReports?.length || 0
  const todayCount = (myReports || []).filter(
    (r: { created_at: string }) => new Date(r.created_at) >= todayStart,
  ).length

  // Pull all week reports to compute per-user totals + the user's rank.
  const { data: allWeekReports } = await db
    .from('crossing_reports')
    .select('user_id')
    .gte('created_at', weekStart.toISOString())
    .not('user_id', 'is', null)

  const perUser: Record<string, number> = {}
  for (const r of allWeekReports || []) {
    const uid = r.user_id as string | null
    if (!uid) continue
    perUser[uid] = (perUser[uid] || 0) + 1
  }
  const totals = Object.values(perUser).sort((a, b) => b - a)
  const rank = weekCount > 0
    ? totals.findIndex((n) => n <= weekCount) + 1 || totals.length
    : null
  const totalGuardians = totals.length

  return NextResponse.json(
    { weekCount, todayCount, rank, totalGuardians },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
