import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

interface AppEventRow {
  user_id: string | null
  session_id: string | null
  created_at: string
  props: Record<string, unknown> | null
  event_name?: string
}


export async function GET() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Funnel stages (last 30d)
  const STAGES = [
    'home_visited',
    'signup_viewed',
    'install_sheet_shown',
    'pwa_grant_claimed',
    'alert_created',
    'report_submitted',
  ]

  const funnelPromises = STAGES.map(async (name) => {
    const { count } = await db
      .from('app_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', name)
      .gte('created_at', since30d)
    const { data: usersData } = await db
      .from('app_events')
      .select('user_id')
      .eq('event_name', name)
      .gte('created_at', since30d)
      .not('user_id', 'is', null)
      .limit(50000)
    const unique_users = new Set((usersData || []).map(r => r.user_id)).size
    return { stage: name, fires: count ?? 0, unique_users }
  })
  const funnel = await Promise.all(funnelPromises)

  // First-touch acquisition map (last 30d)
  const { data: firstOpenRaw } = await db
    .from('app_events')
    .select('user_id, session_id, created_at, props')
    .eq('event_name', 'app_first_open')
    .gte('created_at', since30d)
    .order('created_at', { ascending: false })
    .limit(500)
  const first_opens = (firstOpenRaw || []).map((r: AppEventRow) => {
    const p = r.props ?? {}
    return {
      session_id: r.session_id,
      created_at: r.created_at,
      lat: typeof p.lat === 'number' ? p.lat : null,
      lng: typeof p.lng === 'number' ? p.lng : null,
      install_source: typeof p.install_source === 'string' ? p.install_source : null,
      referrer: typeof p.referrer === 'string' ? p.referrer : null,
      ref: typeof p.ref === 'string' ? p.ref : null,
      path: typeof p.path === 'string' ? p.path : null,
    }
  })

  // Active-during-crossing cohort (wait_checked_at_port last 7d, by port)
  const { data: atPortRaw } = await db
    .from('app_events')
    .select('user_id, session_id, props, created_at')
    .eq('event_name', 'wait_checked_at_port')
    .gte('created_at', since7d)
    .limit(50000)
  const portCounts = new Map<string, { fires: number; users: Set<string>; sessions: Set<string> }>()
  for (const r of atPortRaw || []) {
    const p = r.props ?? {}
    const portId = typeof p.port_id === 'string' ? p.port_id : 'unknown'
    const cur = portCounts.get(portId) ?? { fires: 0, users: new Set(), sessions: new Set() }
    cur.fires++
    if (r.user_id) cur.users.add(r.user_id)
    if (r.session_id) cur.sessions.add(r.session_id)
    portCounts.set(portId, cur)
  }
  const at_port_by_port = [...portCounts.entries()]
    .map(([port_id, c]) => ({ port_id, fires: c.fires, unique_users: c.users.size, unique_sessions: c.sessions.size }))
    .sort((a, b) => b.fires - a.fires)

  // DAU — distinct user_id by day from home_visited (last 30d)
  const { data: dauRaw } = await db
    .from('app_events')
    .select('user_id, created_at')
    .eq('event_name', 'home_visited')
    .gte('created_at', since30d)
    .not('user_id', 'is', null)
    .limit(100000)
  const byDay = new Map<string, Set<string>>()
  for (const r of (dauRaw ?? []) as Array<{ user_id: string | null; created_at: string }>) {
    if (!r.user_id) continue
    const day = r.created_at.slice(0, 10)
    const cur = byDay.get(day) ?? new Set()
    cur.add(r.user_id)
    byDay.set(day, cur)
  }
  const dau = [...byDay.entries()]
    .map(([day, users]) => ({ day, users: users.size }))
    .sort((a, b) => a.day.localeCompare(b.day))

  // Push delivery rate
  const [{ count: alertsCreated }, { count: alertsFired }] = await Promise.all([
    db.from('app_events').select('id', { count: 'exact', head: true }).eq('event_name', 'alert_created').gte('created_at', since30d),
    db.from('app_events').select('id', { count: 'exact', head: true }).eq('event_name', 'alert_fired').gte('created_at', since30d),
  ])

  // Bounce signal — bridge_detail_viewed where bounce=true / total
  const { data: dwellRaw } = await db
    .from('app_events')
    .select('props')
    .eq('event_name', 'bridge_detail_dwell')
    .gte('created_at', since30d)
    .limit(50000)
  let bounceCount = 0
  let totalDwell = 0
  let dwellMsSum = 0
  for (const r of dwellRaw || []) {
    const p = r.props ?? {}
    totalDwell++
    if (p.bounce === true) bounceCount++
    if (typeof p.dwell_ms === 'number') dwellMsSum += p.dwell_ms
  }
  const avg_dwell_ms = totalDwell > 0 ? Math.round(dwellMsSum / totalDwell) : 0

  // Geo permission denial rate
  const { count: geoDeniedCount } = await db.from('app_events').select('id', { count: 'exact', head: true }).eq('event_name', 'geo_denied').gte('created_at', since30d)
  const { count: pushDeniedCount } = await db.from('app_events').select('id', { count: 'exact', head: true }).eq('event_name', 'push_permission_denied').gte('created_at', since30d)

  // Pro-feature blocked counts (which gates fire most)
  const { data: blockedRaw } = await db
    .from('app_events')
    .select('props')
    .eq('event_name', 'pro_feature_blocked')
    .gte('created_at', since30d)
    .limit(50000)
  const blockedCounts = new Map<string, number>()
  for (const r of blockedRaw || []) {
    const p = r.props ?? {}
    const f = typeof p.feature === 'string' ? p.feature : 'unknown'
    blockedCounts.set(f, (blockedCounts.get(f) ?? 0) + 1)
  }
  const pro_blocked_by_feature = [...blockedCounts.entries()]
    .map(([feature, fires]) => ({ feature, fires }))
    .sort((a, b) => b.fires - a.fires)

  return NextResponse.json({
    window: { since_30d: since30d, since_7d: since7d },
    funnel,
    first_opens,
    at_port_by_port,
    dau,
    push: {
      alerts_created: alertsCreated ?? 0,
      alerts_fired: alertsFired ?? 0,
      delivery_rate: alertsCreated && alertsCreated > 0 ? Math.round(((alertsFired ?? 0) / alertsCreated) * 100) / 100 : null,
    },
    dwell: {
      total: totalDwell,
      bounce_count: bounceCount,
      bounce_rate: totalDwell > 0 ? Math.round((bounceCount / totalDwell) * 100) / 100 : null,
      avg_ms: avg_dwell_ms,
    },
    permissions: {
      geo_denied: geoDeniedCount ?? 0,
      push_denied: pushDeniedCount ?? 0,
    },
    pro_blocked_by_feature,
  })
}
