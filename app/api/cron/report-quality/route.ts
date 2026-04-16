import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Report Quality Manager — runs every 15 min via cron-job.org.
// Auto-hides spam, contradictory, and gibberish reports.
//
// Rules:
// 1. Gibberish: description < 3 real words + random chars
// 2. Contradictions: "clear" + wait > 60 min, "accident" + 0 min wait
// 3. Tag spam: 5+ extra tags on a single report
// 4. Repeat offender: user with 3+ hidden reports → auto-hide all future
// 5. XSS attempts: any < or > in description after sanitization
//
// Hidden reports get severity='hidden' — they stay in the DB for audit
// but don't appear in feeds (ReportsFeed filters on severity != 'hidden').
//
// Schedule: every 15 min
// URL: https://www.cruzar.app/api/cron/report-quality?secret=CRON_SECRET

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Fetch recent reports that haven't been reviewed yet
  const { data: reports, error } = await db
    .from('crossing_reports')
    .select('id, user_id, port_id, report_type, description, wait_minutes, severity, source_meta, created_at')
    .gte('created_at', oneHourAgo)
    .neq('severity', 'hidden')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reports || reports.length === 0) return NextResponse.json({ checked: 0, hidden: 0 })

  const toHide: string[] = []
  const reasons: Record<string, string> = {}

  for (const r of reports) {
    const desc = (r.description || '').trim()

    // Rule 1: XSS / HTML in description
    if (desc.includes('<') || desc.includes('>') || /script|onclick|onerror|javascript:/i.test(desc)) {
      toHide.push(r.id)
      reasons[r.id] = 'xss_attempt'
      continue
    }

    // Rule 2: Gibberish — mostly non-word characters or very short random strings
    if (desc.length > 0) {
      const words = desc.split(/\s+/).filter((w: string) => /^[a-záéíóúñü']+$/i.test(w))
      const gibberishRatio = words.length / Math.max(desc.split(/\s+/).length, 1)
      if (desc.length > 5 && gibberishRatio < 0.3) {
        toHide.push(r.id)
        reasons[r.id] = 'gibberish'
        continue
      }
    }

    // Rule 3: Contradictions
    if (r.report_type === 'clear' && r.wait_minutes != null && r.wait_minutes > 60) {
      toHide.push(r.id)
      reasons[r.id] = 'contradiction_clear_high_wait'
      continue
    }
    if (r.report_type === 'accident' && r.wait_minutes != null && r.wait_minutes === 0) {
      toHide.push(r.id)
      reasons[r.id] = 'contradiction_accident_zero_wait'
      continue
    }

    // Rule 4: Tag spam (5+ extra tags)
    const meta = r.source_meta as { extra_tags?: string[] } | null
    if (meta?.extra_tags && meta.extra_tags.length > 5) {
      toHide.push(r.id)
      reasons[r.id] = 'tag_spam'
      continue
    }
  }

  // Rule 5: Repeat offenders — users with 2+ already-hidden reports
  // get all their new reports auto-hidden
  if (toHide.length > 0) {
    const offenderIds = [...new Set(
      reports.filter(r => toHide.includes(r.id) && r.user_id).map(r => r.user_id!)
    )]

    if (offenderIds.length > 0) {
      const { data: previouslyHidden } = await db
        .from('crossing_reports')
        .select('user_id')
        .eq('severity', 'hidden')
        .in('user_id', offenderIds)

      const hiddenCounts = new Map<string, number>()
      for (const h of previouslyHidden || []) {
        hiddenCounts.set(h.user_id, (hiddenCounts.get(h.user_id) || 0) + 1)
      }

      // Auto-hide ALL reports from repeat offenders (2+ previous flags)
      for (const r of reports) {
        if (r.user_id && hiddenCounts.get(r.user_id)! >= 2 && !toHide.includes(r.id)) {
          toHide.push(r.id)
          reasons[r.id] = 'repeat_offender'
        }
      }
    }
  }

  // Hide flagged reports
  if (toHide.length > 0) {
    await db
      .from('crossing_reports')
      .update({ severity: 'hidden' })
      .in('id', toHide)

    // Deduct points from offenders
    const offenders = [...new Set(
      reports.filter(r => toHide.includes(r.id) && r.user_id).map(r => r.user_id!)
    )]
    for (const userId of offenders) {
      const hiddenCount = toHide.filter(id => reports.find(r => r.id === id)?.user_id === userId).length
      const pointsToDeduct = hiddenCount * 15 // More than they earned
      const { data: profile } = await db
        .from('profiles')
        .select('points')
        .eq('id', userId)
        .single()
      if (profile) {
        await db.from('profiles').update({
          points: Math.max(0, (profile.points || 0) - pointsToDeduct),
        }).eq('id', userId)
      }
    }
  }

  return NextResponse.json({
    checked: reports.length,
    hidden: toHide.length,
    reasons: Object.values(reasons).reduce((acc, r) => {
      acc[r] = (acc[r] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  })
}
