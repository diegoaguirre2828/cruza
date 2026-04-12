import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type SortKey = 'created_desc' | 'created_asc' | 'reports_desc' | 'points_desc' | 'last_active_desc' | 'last_signin_desc'

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
  const url = new URL(req.url)
  const search = (url.searchParams.get('search') || '').toLowerCase().trim()
  const tierFilter = url.searchParams.get('tier') || 'all'
  const sort = (url.searchParams.get('sort') || 'created_desc') as SortKey
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)))

  // Pull up to 1000 auth users (covers Diego's 1k-in-3-months goal; paginate if we blow past)
  const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUsers = authData?.users || []
  const authById = new Map(authUsers.map(u => [u.id, u]))

  // Profiles
  const { data: profiles } = await db
    .from('profiles')
    .select('id, display_name, tier, points, reports_count, badges, created_at')

  // Report aggregates (count + most recent timestamp per user)
  const { data: reportRows } = await db
    .from('crossing_reports')
    .select('user_id, created_at')
    .not('user_id', 'is', null)

  const reportStats = new Map<string, { count: number; lastAt: string | null }>()
  for (const r of reportRows || []) {
    if (!r.user_id) continue
    const s = reportStats.get(r.user_id) || { count: 0, lastAt: null }
    s.count++
    if (!s.lastAt || (r.created_at && r.created_at > s.lastAt)) s.lastAt = r.created_at
    reportStats.set(r.user_id, s)
  }

  // Active subscriptions
  const { data: subRows } = await db
    .from('subscriptions')
    .select('user_id, tier, status, current_period_end')

  const subById = new Map((subRows || []).map(s => [s.user_id, s]))

  // Join
  let rows = (profiles || []).map(p => {
    const auth = authById.get(p.id)
    const stats = reportStats.get(p.id)
    return {
      id: p.id,
      email: auth?.email || p.display_name || '',
      display_name: p.display_name || null,
      tier: p.tier || 'free',
      points: p.points || 0,
      reports_count: stats?.count || p.reports_count || 0,
      last_report_at: stats?.lastAt || null,
      last_sign_in_at: auth?.last_sign_in_at || null,
      created_at: p.created_at || auth?.created_at || null,
      badges: p.badges || [],
      sub_status: subById.get(p.id)?.status || null,
      sub_tier: subById.get(p.id)?.tier || null,
    }
  })

  // Filter
  if (tierFilter !== 'all') rows = rows.filter(r => r.tier === tierFilter)
  if (search) {
    rows = rows.filter(r =>
      r.email.toLowerCase().includes(search) ||
      (r.display_name || '').toLowerCase().includes(search)
    )
  }

  // Sort
  const cmpStr = (a: string | null, b: string | null) => (b || '').localeCompare(a || '')
  const sorters: Record<SortKey, (a: typeof rows[number], b: typeof rows[number]) => number> = {
    created_desc:     (a, b) => cmpStr(a.created_at, b.created_at),
    created_asc:      (a, b) => cmpStr(b.created_at, a.created_at),
    reports_desc:     (a, b) => b.reports_count - a.reports_count,
    points_desc:      (a, b) => b.points - a.points,
    last_active_desc: (a, b) => cmpStr(a.last_report_at, b.last_report_at),
    last_signin_desc: (a, b) => cmpStr(a.last_sign_in_at, b.last_sign_in_at),
  }
  rows.sort(sorters[sort] || sorters.created_desc)

  const total = rows.length
  const paged = rows.slice((page - 1) * pageSize, page * pageSize)

  return NextResponse.json({ users: paged, total, page, pageSize })
}
