import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// /api/admin/ops-glance — one-shot aggregated health for the admin
// dashboard's top tile. Surfaces the 10 numbers Diego cares about at
// login + keeps the SQL-side hit count low (each call issues about
// a dozen lightweight count() queries in parallel).
//
// Returns shape:
// {
//   users: { total, pro, business, new24h, new7d },
//   reports: { count24h, count7d, hidden24h, avgUpvotes24h },
//   waitReadings: { lastReadingAt, count15m, count24h, pctPortsFresh },
//   socialPosts: { page24h, group24h, lastPagePostAt, lastGroupPostAt },
//   circles: { total, memberships, invitesOpen, invitesAccepted },
//   alerts: { activePrefs, firedToday },
//   banned: { usersCurrentlyBanned, reportsCurrentlyHidden },
//   infra: { subscriptionsTotal, pwaInstalls, generatedAt }
// }

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const now = Date.now()
  const iso24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const iso7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const iso15m = new Date(now - 15 * 60 * 1000).toISOString()
  const iso72h = new Date(now - 72 * 60 * 60 * 1000).toISOString()
  const isoToday = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()

  // Kick every count query in parallel — all tolerate failure (maybeSingle
  // won't, but count() returns { count: null } on error which we default
  // to 0 downstream).
  const [
    usersTotal,
    usersPro,
    usersBusiness,
    usersNew24h,
    usersNew7d,
    usersBanned,
    pwaInstalls,
    reports24h,
    reports7d,
    reportsHidden24h,
    readings15m,
    readings24h,
    latestReading,
    portsFresh,
    socialPage24h,
    socialGroup24h,
    latestPagePost,
    latestGroupPost,
    alertsActive,
    alertsFiredToday,
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('tier', 'pro'),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('tier', 'business'),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', iso24h),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', iso7d),
    db.from('profiles').select('id', { count: 'exact', head: true }).gt('banned_until', new Date(now).toISOString()),
    db.from('profiles').select('id', { count: 'exact', head: true }).not('pwa_installed_at', 'is', null),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', iso24h).is('hidden_at', null),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', iso7d).is('hidden_at', null),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('hidden_at', iso24h),
    db.from('wait_time_readings').select('id', { count: 'exact', head: true }).gte('recorded_at', iso15m),
    db.from('wait_time_readings').select('id', { count: 'exact', head: true }).gte('recorded_at', iso24h),
    db.from('wait_time_readings').select('recorded_at').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('wait_time_readings').select('port_id').gte('recorded_at', iso72h).not('vehicle_wait', 'is', null),
    db.from('social_posts').select('id', { count: 'exact', head: true }).eq('platform', 'facebook_page').gte('posted_at', iso24h),
    db.from('social_posts').select('id', { count: 'exact', head: true }).eq('platform', 'facebook_group').gte('posted_at', iso24h),
    db.from('social_posts').select('posted_at').eq('platform', 'facebook_page').order('posted_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('social_posts').select('posted_at').eq('platform', 'facebook_group').order('posted_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('alert_preferences').select('id', { count: 'exact', head: true }).eq('active', true),
    db.from('alert_preferences').select('id', { count: 'exact', head: true }).gte('last_triggered_at', isoToday),
  ])

  // Fresh ports ratio — unique port_ids with a reading in last 72h.
  const uniqueFreshPorts = new Set<string>((portsFresh.data || []).map((r) => r.port_id))
  // Expected ~52 CBP ports. Any lower = silent data loss.
  const pctPortsFresh = Math.round((uniqueFreshPorts.size / 52) * 100)

  return NextResponse.json({
    users: {
      total: usersTotal.count ?? 0,
      pro: usersPro.count ?? 0,
      business: usersBusiness.count ?? 0,
      new24h: usersNew24h.count ?? 0,
      new7d: usersNew7d.count ?? 0,
    },
    reports: {
      count24h: reports24h.count ?? 0,
      count7d: reports7d.count ?? 0,
      hidden24h: reportsHidden24h.count ?? 0,
    },
    waitReadings: {
      lastReadingAt: latestReading.data?.recorded_at ?? null,
      count15m: readings15m.count ?? 0,
      count24h: readings24h.count ?? 0,
      portsFresh72h: uniqueFreshPorts.size,
      pctPortsFresh,
    },
    socialPosts: {
      page24h: socialPage24h.count ?? 0,
      group24h: socialGroup24h.count ?? 0,
      lastPagePostAt: latestPagePost.data?.posted_at ?? null,
      lastGroupPostAt: latestGroupPost.data?.posted_at ?? null,
    },
    alerts: {
      activePrefs: alertsActive.count ?? 0,
      firedToday: alertsFiredToday.count ?? 0,
    },
    moderation: {
      usersCurrentlyBanned: usersBanned.count ?? 0,
    },
    infra: {
      pwaInstalls: pwaInstalls.count ?? 0,
      generatedAt: new Date(now).toISOString(),
    },
  })
}
