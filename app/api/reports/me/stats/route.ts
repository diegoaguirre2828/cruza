import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lightweight stats endpoint for the StreakImpactPill on the home screen.
// Returns the consecutive-day reporting streak, total helped count, and
// this-week count. Server-side computation keeps the home page small.

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, signedIn: false })

  const db = getServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: rows }, { data: profile }] = await Promise.all([
    db
      .from('crossing_reports')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    db.from('profiles').select('reports_count, points').eq('id', user.id).maybeSingle(),
  ])

  const all = rows ?? []
  const helped = profile?.reports_count ?? all.length
  const points = profile?.points ?? 0
  const thisWeek = all.filter(r => r.created_at >= weekAgo).length

  // Consecutive-day streak — walk back day by day from today (UTC),
  // stop on the first day with zero reports.
  const dayKey = (iso: string) => iso.slice(0, 10)
  const days = new Set(all.map(r => dayKey(r.created_at)))
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 60; i++) {
    const key = cursor.toISOString().slice(0, 10)
    if (days.has(key)) {
      streak++
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else if (i === 0 && days.size > 0) {
      // If today has no report yet but yesterday does, we still want to
      // surface yesterday's streak so the user knows what they're about
      // to break. Roll back once and continue.
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else {
      break
    }
  }

  return NextResponse.json(
    { ok: true, signedIn: true, streak, helped, this_week: thisWeek, points },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
