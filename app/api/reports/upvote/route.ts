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

  // Check if already upvoted
  const { data: existing } = await db
    .from('report_upvotes')
    .select('id')
    .eq('report_id', reportId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // Remove upvote
    await db.from('report_upvotes').delete().eq('report_id', reportId).eq('user_id', user.id)
    const { data: cur } = await db.from('crossing_reports').select('upvotes').eq('id', reportId).single()
    await db.from('crossing_reports').update({ upvotes: Math.max(0, (cur?.upvotes || 1) - 1) }).eq('id', reportId)
    return NextResponse.json({ upvoted: false })
  }

  // Add upvote
  await db.from('report_upvotes').insert({ report_id: reportId, user_id: user.id })

  // Increment upvote count on report
  const { data: report } = await db
    .from('crossing_reports')
    .select('upvotes, user_id')
    .eq('id', reportId)
    .single()

  if (report) {
    await db.from('crossing_reports')
      .update({ upvotes: (report.upvotes || 0) + 1 })
      .eq('id', reportId)

    // Award points to report author
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
