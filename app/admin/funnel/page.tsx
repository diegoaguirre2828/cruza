'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

interface FunnelStage { stage: string; fires: number; unique_users: number }
interface FirstOpen { created_at: string; lat: number | null; lng: number | null; install_source: string | null; referrer: string | null; ref: string | null; path: string | null }
interface AtPortRow { port_id: string; fires: number; unique_users: number; unique_sessions: number }
interface DauRow { day: string; users: number }
interface ProBlockedRow { feature: string; fires: number }

interface FunnelData {
  funnel: FunnelStage[]
  first_opens: FirstOpen[]
  at_port_by_port: AtPortRow[]
  dau: DauRow[]
  push: { alerts_created: number; alerts_fired: number; delivery_rate: number | null }
  dwell: { total: number; bounce_count: number; bounce_rate: number | null; avg_ms: number }
  permissions: { geo_denied: number; push_denied: number }
  pro_blocked_by_feature: ProBlockedRow[]
}

export default function FunnelPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<FunnelData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user || user.email !== ADMIN_EMAIL) return
    fetch('/api/admin/funnel-stats', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(setData)
      .catch((e) => setError(String(e)))
  }, [user, authLoading])

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  }
  if (!user || user.email !== ADMIN_EMAIL) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 p-6 text-center">Admin only.</div>
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Admin
        </Link>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 font-display mb-1">Cruzar funnel</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Last 30 days · auto-refresh on mount</p>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {!data && !error && <p className="text-sm text-gray-400">Loading data…</p>}

        {data && (
          <div className="space-y-6">

            {/* DAU LINE CHART */}
            <Section title="Daily active users" subtitle="distinct user_ids per day from home_visited">
              <div className="h-56 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dau} margin={{ top: 5, right: 12, bottom: 5, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* FUNNEL */}
            <Section title="Acquisition funnel" subtitle="sequential conversion across the lifecycle">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {data.funnel.map((s, i) => {
                  const prev = i > 0 ? data.funnel[i - 1].unique_users : null
                  const conv = prev != null && prev > 0 ? Math.round((s.unique_users / prev) * 100) : null
                  const w = i === 0 ? 100 : (data.funnel[0].unique_users > 0 ? Math.round((s.unique_users / data.funnel[0].unique_users) * 100) : 0)
                  return (
                    <div key={s.stage} className="px-4 py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{s.stage}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {s.unique_users} users · {s.fires.toLocaleString()} fires{conv != null ? ` · ${conv}% from prev` : ''}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* ACTIVE DURING CROSSING */}
            <Section title="Active at the bridge" subtitle="wait_checked_at_port (within 3km), last 7 days">
              {data.at_port_by_port.length === 0 ? (
                <p className="text-xs text-gray-400 px-4">No fires yet — event was just deployed.</p>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  {data.at_port_by_port.slice(0, 12).map((r) => (
                    <div key={r.port_id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-mono">{r.port_id}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        {r.fires} fires · {r.unique_users} users · {r.unique_sessions} sessions
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* FIRST-TOUCH ACQUISITION */}
            <Section title="First app opens" subtitle="last 30 days · most recent 30 shown">
              {data.first_opens.length === 0 ? (
                <p className="text-xs text-gray-400 px-4">No first-open events yet — event was just deployed.</p>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden text-xs">
                  <div className="grid grid-cols-[120px_1fr_1fr_80px_1fr] gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">
                    <span>When</span>
                    <span>Geo</span>
                    <span>Source</span>
                    <span>Install</span>
                    <span>Path / Ref</span>
                  </div>
                  {data.first_opens.slice(0, 30).map((r, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr_1fr_80px_1fr] gap-2 px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                      <span className="tabular-nums">{new Date(r.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      <span className="tabular-nums">{r.lat != null && r.lng != null ? `${r.lat.toFixed(2)}, ${r.lng.toFixed(2)}` : '—'}</span>
                      <span className="truncate" title={r.referrer || ''}>{r.referrer ? new URL(r.referrer).hostname : '—'}</span>
                      <span>{r.install_source ?? '—'}</span>
                      <span className="truncate" title={`${r.path} ${r.ref ? '· ' + r.ref : ''}`}>{r.path}{r.ref ? ` · ${r.ref}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* OPERATIONAL TILES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Tile label="Push delivery" lines={[
                `${data.push.alerts_created} alerts created`,
                `${data.push.alerts_fired} alerts fired`,
                data.push.delivery_rate != null ? `${(data.push.delivery_rate * 100).toFixed(0)}% delivery rate` : '—',
              ]} />
              <Tile label="Bridge dwell" lines={[
                `${data.dwell.total} views recorded`,
                data.dwell.bounce_rate != null ? `${(data.dwell.bounce_rate * 100).toFixed(0)}% bounce <5s` : '—',
                `${(data.dwell.avg_ms / 1000).toFixed(1)}s avg dwell`,
              ]} />
              <Tile label="Permissions" lines={[
                `${data.permissions.geo_denied} geo denied`,
                `${data.permissions.push_denied} push denied`,
              ]} />
              <Tile label="Pro gates hit" lines={
                data.pro_blocked_by_feature.length === 0
                  ? ['No fires yet']
                  : data.pro_blocked_by_feature.slice(0, 4).map(r => `${r.fires} · ${r.feature}`)
              } />
            </div>

          </div>
        )}
      </div>
    </main>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 px-1">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Tile({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{l}</li>
        ))}
      </ul>
    </div>
  )
}
