import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  const now = new Date()
  const ago7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    profilesAll,
    newUsers7,
    newUsers30,
    reportsAll,
    reports7,
    reports30,
    activeUsers7,
    activeUsers30,
    tierCounts,
    recentReports,
    reportCountsByUser,
    alertUsers,
    savedUsers,
    shareCounts,
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ago7),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', ago7),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
    db.from('crossing_reports').select('user_id').gte('created_at', ago7).not('user_id', 'is', null),
    db.from('crossing_reports').select('user_id').gte('created_at', ago30).not('user_id', 'is', null),
    db.from('profiles').select('tier'),
    db.from('crossing_reports')
      .select('id, port_id, report_type, wait_minutes, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    // Aggregate total report counts per user (for power-user segmentation)
    db.from('crossing_reports').select('user_id').not('user_id', 'is', null),
    // Users with at least one active alert (commitment signal)
    db.from('alert_preferences').select('user_id').eq('active', true),
    // Users with at least one saved crossing (personalization signal)
    db.from('saved_crossings').select('user_id'),
    // Share counter aggregate (admin-only metric — not shown to users)
    db.from('profiles').select('share_count'),
  ])

  const activeUsers7Set  = new Set((activeUsers7.data  || []).map(r => r.user_id))
  const activeUsers30Set = new Set((activeUsers30.data || []).map(r => r.user_id))
  const activeUsers7Count  = activeUsers7Set.size
  const activeUsers30Count = activeUsers30Set.size

  const tiers: Record<string, number> = {}
  for (const p of (tierCounts.data || [])) {
    const t = p.tier || 'free'
    tiers[t] = (tiers[t] || 0) + 1
  }

  // Build per-user report counts for segmentation
  const reportsByUser = new Map<string, number>()
  for (const r of (reportCountsByUser.data || [])) {
    if (r.user_id) reportsByUser.set(r.user_id, (reportsByUser.get(r.user_id) || 0) + 1)
  }
  const usersWithAlerts = new Set((alertUsers.data || []).map((a) => a.user_id).filter(Boolean))
  const usersWithSaved  = new Set((savedUsers.data || []).map((s) => s.user_id).filter(Boolean))

  // Pull auth users for last_sign_in_at activity signal
  const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const signedIn7 = new Set<string>()
  const signedIn30 = new Set<string>()
  const now7  = Date.now() - 7  * 24 * 60 * 60 * 1000
  const now30 = Date.now() - 30 * 24 * 60 * 60 * 1000
  for (const u of (authUsers?.users || [])) {
    if (!u.last_sign_in_at) continue
    const t = new Date(u.last_sign_in_at).getTime()
    if (t >= now7) signedIn7.add(u.id)
    if (t >= now30) signedIn30.add(u.id)
  }

  // Compute behavioral segments
  //
  // Active (7d):    any signal within 7 days — sign-in OR report
  // Active (30d):   any signal within 30 days
  // Returning:      2+ reports OR 1+ active alert OR 1+ saved crossing
  //                 (implicit "came back to engage with the product")
  // Power:          3+ reports OR 2+ alerts OR (saved + alert combo)
  //                 (deeply engaged, most likely to convert to Pro)
  const activeAny7 = new Set<string>([...activeUsers7Set, ...signedIn7].filter(Boolean))
  const activeAny30 = new Set<string>([...activeUsers30Set, ...signedIn30].filter(Boolean))

  const allUserIds = new Set<string>()
  for (const p of (tierCounts.data || [])) {
    // tierCounts only selected 'tier' — we need ids, re-fetch
  }
  // Pull the full profile id list for segmentation math
  const { data: allProfileIds } = await db.from('profiles').select('id')
  for (const p of (allProfileIds || [])) allUserIds.add(p.id)

  let returningCount = 0
  let powerCount = 0
  let alertUserCount = 0
  for (const id of allUserIds) {
    const rpts = reportsByUser.get(id) || 0
    const hasAlert = usersWithAlerts.has(id)
    const hasSaved = usersWithSaved.has(id)
    const alertsForUser = hasAlert ? 1 : 0  // we don't have a per-user alert count here

    const isReturning = rpts >= 2 || hasAlert || hasSaved
    const isPower = rpts >= 3 || (hasAlert && hasSaved) || alertsForUser >= 2

    if (isReturning) returningCount++
    if (isPower) powerCount++
    if (hasAlert) alertUserCount++
  }

  // Recent signups — reuse the already-fetched authUsers list above
  const recentUsers = (authUsers?.users || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15)
    .map(u => ({
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
    }))

  // Attach tier from profiles
  const profileTiers: Record<string, string> = {}
  const { data: allProfiles } = await db.from('profiles').select('id, tier')
  for (const p of (allProfiles || [])) profileTiers[p.id] = p.tier

  const recentUsersWithTier = recentUsers.map(u => ({
    ...u,
    tier: profileTiers[u.id] || 'free',
  }))

  // Total shares across all users (admin-only metric — not shown to users)
  const totalShares = (shareCounts.data || []).reduce(
    (sum: number, r: { share_count: number | null }) => sum + (r.share_count || 0),
    0,
  )
  const usersWhoShared = (shareCounts.data || []).filter(
    (r: { share_count: number | null }) => (r.share_count || 0) > 0,
  ).length

  return NextResponse.json({
    users: {
      total:    profilesAll.count ?? 0,
      new7:     newUsers7.count   ?? 0,
      new30:    newUsers30.count  ?? 0,
      active7:  activeAny7.size,   // now includes sign-in OR report in 7d
      active30: activeAny30.size,  // includes sign-in OR report in 30d
      returning: returningCount,   // 2+ reports OR has alert/saved crossing
      power:     powerCount,        // 3+ reports OR (alert + saved)
      withAlerts: alertUserCount,   // personalization / commitment proxy
      totalShares,                  // sum of share_count across all profiles
      usersWhoShared,               // how many distinct users have shared
      byTier:    tiers,
      // keep the old report-only numbers too in case anything reads them
      active7Reports:  activeUsers7Count,
      active30Reports: activeUsers30Count,
    },
    reports: {
      total:  reportsAll.count ?? 0,
      last7:  reports7.count  ?? 0,
      last30: reports30.count ?? 0,
      recent: recentReports.data || [],
    },
    recentUsers: recentUsersWithTier,
  })
}
