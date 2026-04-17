import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { POINTS } from '@/lib/points'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login to upvote' }, { status: 401 })

  const { reportId } = await req.json()
  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

  const db = getServiceClient()

  // Self-upvote guard — fetched BEFORE anything else so the anti-farm
  // check gates every subsequent write. A user upvoting their own
  // report would otherwise earn POINTS.report_upvoted for free every
  // time they toggled it, infinite farm loop.
  const { data: preReport } = await db
    .from('crossing_reports')
    .select('user_id')
    .eq('id', reportId)
    .maybeSingle()

  if (preReport?.user_id && preReport.user_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot upvote your own report.' },
      { status: 403 },
    )
  }

  // Check if already upvoted
  const { data: existing } = await db
    .from('report_upvotes')
    .select('id')
    .eq('report_id', reportId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove upvote — also decrement the author's points to prevent
    // the farm loop "upvote → +points → unupvote → points stay →
    // upvote again → +points again" that would otherwise let anyone
    // farm N × POINTS per toggle round-trip.
    await db.from('report_upvotes').delete().eq('report_id', reportId).eq('user_id', user.id)
    const { data: cur } = await db.from('crossing_reports').select('upvotes, user_id').eq('id', reportId).maybeSingle()
    await db.from('crossing_reports').update({ upvotes: Math.max(0, (cur?.upvotes || 1) - 1) }).eq('id', reportId)
    if (cur?.user_id) {
      const { data: authorProfile } = await db
        .from('profiles')
        .select('points')
        .eq('id', cur.user_id)
        .single()
      await db.from('profiles')
        .update({ points: Math.max(0, (authorProfile?.points || 0) - POINTS.report_upvoted) })
        .eq('id', cur.user_id)
    }
    return NextResponse.json({ upvoted: false })
  }

  // Add upvote
  await db.from('report_upvotes').insert({ report_id: reportId, user_id: user.id })

  // Increment upvote count on report
  const { data: report } = await db
    .from('crossing_reports')
    .select('upvotes, user_id')
    .eq('id', reportId)
    .maybeSingle()

  if (report) {
    await db.from('crossing_reports')
      .update({ upvotes: (report.upvotes || 0) + 1 })
      .eq('id', reportId)

    // Award points to report author (guarded above against self-upvote).
    if (report.user_id) {
      const { data: authorProfile } = await db
        .from('profiles')
        .select('points')
        .eq('id', report.user_id)
        .single()

      await db.from('profiles')
        .update({ points: (authorProfile?.points || 0) + POINTS.report_upvoted })
        .eq('id', report.user_id)
    }
  }

  return NextResponse.json({ upvoted: true })
}
