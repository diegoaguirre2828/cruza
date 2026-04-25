import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { INTEL_SOURCES } from '@/lib/intelSources'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// /api/admin/system-health
//
// Single aggregated health check for every Cruzar subsystem. Diego's
// "is this thing actually working" answer in one place. Each row
// surfaces: name, last activity timestamp, recent volume, status
// (ok/warn/err), and what to check if it's red.
//
// Used by /admin/system-audit to render a single-glance dashboard.

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
  const iso7d  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const iso2h  = new Date(now - 2 * 60 * 60 * 1000).toISOString()

  // Run every check in parallel for speed
  const [
    autoCrossings7d,
    autoCrossingsLast,
    inlandCheckpoints7d,
    optedInProfiles,
    operatorTier,
    businessTier,
    operatorValidations24h,
    operatorLast,
    expressDraft,
    expressPaid,
    expressGenerated,
    intelEvents24h,
    intelEvents2h,
    intelEventsLast,
    intelBriefs7d,
    intelBriefsLast,
    intelAlerts24h,
    intelSubsFree,
    intelSubsPro,
    intelSubsEnt,
    profilesTotal,
    cbpReadingsLast,
  ] = await Promise.all([
    db.from('wait_time_readings').select('*', { count: 'exact', head: true }).eq('source', 'auto_geofence').gte('recorded_at', iso7d),
    db.from('wait_time_readings').select('recorded_at').eq('source', 'auto_geofence').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('inland_checkpoint_readings').select('*', { count: 'exact', head: true }).gte('recorded_at', iso7d),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('auto_geofence_opt_in', true),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'operator'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'business'),
    db.from('operator_validations').select('*', { count: 'exact', head: true }).gte('created_at', iso24h),
    db.from('operator_validations').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('express_cert_applications').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    db.from('express_cert_applications').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
    db.from('express_cert_applications').select('*', { count: 'exact', head: true }).eq('status', 'generated'),
    db.from('intel_events').select('*', { count: 'exact', head: true }).gte('ingested_at', iso24h),
    db.from('intel_events').select('*', { count: 'exact', head: true }).gte('ingested_at', iso2h),
    db.from('intel_events').select('ingested_at, source').order('ingested_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('intel_briefs').select('*', { count: 'exact', head: true }).gte('published_at', iso7d),
    db.from('intel_briefs').select('published_at, title').order('published_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('intel_alerts').select('*', { count: 'exact', head: true }).gte('sent_at', iso24h),
    db.from('intel_subscribers').select('*', { count: 'exact', head: true }).eq('active', true).eq('tier', 'free'),
    db.from('intel_subscribers').select('*', { count: 'exact', head: true }).eq('active', true).eq('tier', 'pro'),
    db.from('intel_subscribers').select('*', { count: 'exact', head: true }).eq('active', true).eq('tier', 'enterprise'),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('wait_time_readings').select('recorded_at').eq('source', 'cbp').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Per-intel-source freshness — quick look at which RSS feeds are
  // dry. Anything that hasn't ingested in 6h on a working feed = warn.
  const sourceFreshness: Record<string, { lastIngested: string | null; status: 'ok' | 'warn' | 'err' }> = {}
  for (const src of INTEL_SOURCES) {
    const { data: latest } = await db
      .from('intel_events')
      .select('ingested_at')
      .eq('source', src.id)
      .order('ingested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastTs = latest?.ingested_at ? new Date(latest.ingested_at).getTime() : 0
    let status: 'ok' | 'warn' | 'err' = 'ok'
    if (!lastTs) status = 'err'
    else if (now - lastTs > 6 * 60 * 60 * 1000) status = 'warn'
    sourceFreshness[src.id] = { lastIngested: latest?.ingested_at || null, status }
  }

  // Stripe price IDs presence — if any are missing the corresponding
  // checkout will 500.
  const stripeKeys: Record<string, boolean> = {
    pro: !!process.env.STRIPE_PRO_PRICE_ID,
    business: !!process.env.STRIPE_BUSINESS_PRICE_ID,
    operator: !!process.env.STRIPE_OPERATOR_PRICE_ID,
    express_cert: !!process.env.STRIPE_EXPRESS_CERT_PRICE_ID,
    intelligence: !!process.env.STRIPE_INTELLIGENCE_PRICE_ID,
    intelligence_enterprise: !!process.env.STRIPE_INTELLIGENCE_ENTERPRISE_PRICE_ID,
  }

  // Critical infra env vars
  const infraEnv: Record<string, boolean> = {
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK: !!process.env.STRIPE_WEBHOOK_SECRET,
    ANTHROPIC: !!process.env.ANTHROPIC_API_KEY,
    RESEND: !!process.env.RESEND_API_KEY,
    BLOB: !!process.env.BLOB_READ_WRITE_TOKEN,
    UPSTASH_REDIS_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    CRON_SECRET: !!process.env.CRON_SECRET,
    VAPID_PUBLIC: !!process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE: !!process.env.VAPID_PRIVATE_KEY,
  }

  // Status helpers
  const ago = (iso: string | null | undefined): { ms: number; label: string } => {
    if (!iso) return { ms: Infinity, label: 'never' }
    const ms = now - new Date(iso).getTime()
    if (ms < 60_000) return { ms, label: `${Math.round(ms / 1000)}s ago` }
    if (ms < 60 * 60_000) return { ms, label: `${Math.round(ms / 60_000)}m ago` }
    if (ms < 24 * 60 * 60_000) return { ms, label: `${Math.round(ms / (60 * 60_000))}h ago` }
    return { ms, label: `${Math.round(ms / (24 * 60 * 60_000))}d ago` }
  }

  const cbpAgo = ago(cbpReadingsLast.data?.recorded_at)
  const intelAgo = ago(intelEventsLast.data?.ingested_at)
  const briefAgo = ago(intelBriefsLast.data?.published_at)
  const operatorAgo = ago(operatorLast.data?.created_at)
  const autoCrossingAgo = ago(autoCrossingsLast.data?.recorded_at)

  // Build the report
  const subsystems = [
    {
      key: 'cbp_ingest',
      name: 'CBP wait-time scrape',
      status: cbpAgo.ms < 30 * 60_000 ? 'ok' : cbpAgo.ms < 2 * 60 * 60_000 ? 'warn' : 'err',
      lastActivity: cbpAgo.label,
      detail: 'Should fire every 15 min via cron-job.org',
    },
    {
      key: 'auto_crossing',
      name: 'Auto-crossing detection',
      status: optedInProfiles.count && (autoCrossings7d.count ?? 0) > 0 ? 'ok' : 'warn',
      lastActivity: autoCrossingAgo.label,
      detail: `${optedInProfiles.count ?? 0} opted-in profiles · ${autoCrossings7d.count ?? 0} crossings in 7d · ${inlandCheckpoints7d.count ?? 0} inland dwells in 7d`,
    },
    {
      key: 'operator_validations',
      name: 'Operator AI validations',
      status: (operatorTier.count ?? 0) > 0 ? 'ok' : 'warn',
      lastActivity: operatorAgo.label,
      detail: `${operatorTier.count ?? 0} operator subs · ${businessTier.count ?? 0} business subs · ${operatorValidations24h.count ?? 0} validations in 24h`,
    },
    {
      key: 'express_cert',
      name: 'Express Cert pipeline',
      status: 'ok',
      lastActivity: '—',
      detail: `${expressDraft.count ?? 0} draft · ${expressPaid.count ?? 0} paid · ${expressGenerated.count ?? 0} generated`,
    },
    {
      key: 'intel_ingest',
      name: 'Intelligence ingestion',
      status: intelAgo.ms < 2 * 60 * 60_000 ? 'ok' : intelAgo.ms < 6 * 60 * 60_000 ? 'warn' : 'err',
      lastActivity: intelAgo.label,
      detail: `${intelEvents2h.count ?? 0} events in last 2h · ${intelEvents24h.count ?? 0} in 24h`,
    },
    {
      key: 'intel_briefs',
      name: 'Intelligence daily brief',
      status: briefAgo.ms < 26 * 60 * 60_000 ? 'ok' : 'warn',
      lastActivity: briefAgo.label,
      detail: `${intelBriefs7d.count ?? 0} briefs in 7d · latest "${(intelBriefsLast.data?.title || '').slice(0, 60)}"`,
    },
    {
      key: 'intel_alerts',
      name: 'Intelligence real-time alerts',
      status: (intelSubsPro.count ?? 0) + (intelSubsEnt.count ?? 0) === 0 ? 'warn' : 'ok',
      lastActivity: 'every 15 min',
      detail: `${intelAlerts24h.count ?? 0} alerts sent in 24h · ${intelSubsPro.count ?? 0} pro subs · ${intelSubsEnt.count ?? 0} enterprise subs · ${intelSubsFree.count ?? 0} free brief subs`,
    },
  ]

  return NextResponse.json({
    overall: subsystems.every((s) => s.status === 'ok') ? 'ok' : subsystems.some((s) => s.status === 'err') ? 'err' : 'warn',
    subsystems,
    sources: { freshness: sourceFreshness },
    stripe: { priceIds: stripeKeys },
    infra: { env: infraEnv },
    aggregate: {
      profilesTotal: profilesTotal.count ?? 0,
      operatorMRR: (operatorTier.count ?? 0) * 99,
      businessMRR: (businessTier.count ?? 0) * 19.99,
      intelMRR: (intelSubsPro.count ?? 0) * 49 + (intelSubsEnt.count ?? 0) * 499,
      expressLifetime: ((expressPaid.count ?? 0) + (expressGenerated.count ?? 0)) * 499,
    },
    generatedAt: new Date().toISOString(),
  })
}

