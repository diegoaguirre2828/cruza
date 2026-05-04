import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getServiceClient } from '@/lib/supabase'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPortMeta } from '@/lib/portMeta'
import { isIOSAppUserAgent } from '@/lib/platform'
import type { CruzarCrossingV1 } from '@/lib/crossing/types'

export const dynamic = 'force-dynamic'

interface RowShape {
  id: string
  user_id: string
  port_id: string
  direction: 'us_to_mx' | 'mx_to_us'
  status: CruzarCrossingV1['status']
  modules_present: string[]
  blocks: CruzarCrossingV1['blocks']
  signature: string | null
  signing_key_id: string | null
  started_at: string
  ended_at: string | null
}

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export default async function CrossingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const userId = await getUserId()
  if (!userId) redirect(`/signup?next=${encodeURIComponent(`/crossing/${id}`)}`)

  const db = getServiceClient()
  const { data } = await db
    .from('crossings')
    .select('id, user_id, port_id, direction, status, modules_present, blocks, signature, signing_key_id, started_at, ended_at')
    .eq('id', id)
    .maybeSingle()

  if (!data || data.user_id !== userId) notFound()

  const row = data as RowShape

  // Single-language render. iOS app uses CruzarIOS UA; web users have
  // their LangContext localStorage choice mirrored on profile.language
  // (v84). Server-render the user's chosen language. For now, default
  // to es since we lack a server-side LangContext (the toggle persists
  // to profiles.language but this page renders before any client hooks).
  const h = await headers()
  const ua = h.get('user-agent') || ''
  const isIosApp = isIOSAppUserAgent(ua)
  // Pull language from profile for accurate per-user copy.
  const { data: profileRow } = await db
    .from('profiles')
    .select('language')
    .eq('id', userId)
    .maybeSingle()
  const lang = (profileRow?.language === 'en') ? 'en' : 'es'
  const es = lang === 'es'

  const meta = getPortMeta(row.port_id)
  const portName = meta.localName || meta.city || row.port_id

  const startedDate = new Date(row.started_at)
  const endedDate = row.ended_at ? new Date(row.ended_at) : null
  const durationMin = endedDate ? Math.round((endedDate.getTime() - startedDate.getTime()) / 60000) : null
  const directionLabel = es
    ? (row.direction === 'us_to_mx' ? 'US → MX' : 'MX → US')
    : (row.direction === 'us_to_mx' ? 'US → MX' : 'MX → US')

  const t = es ? {
    title: 'Tu cruce',
    fromTo: directionLabel,
    started: 'Iniciado',
    ended: 'Terminado',
    duration: 'Duración',
    minutes: 'min',
    inProgress: 'En curso',
    status: 'Estado',
    modules: 'Módulos',
    blocks: 'Bloques',
    signature: 'Firma',
    backToDashboard: '← Volver al inicio',
    statusLabels: {
      planning: 'Planeando',
      en_route: 'En camino',
      in_line: 'En fila',
      crossing: 'Cruzando',
      completed: 'Completado',
      abandoned: 'Cancelado',
    } as Record<string, string>,
  } : {
    title: 'Your crossing',
    fromTo: directionLabel,
    started: 'Started',
    ended: 'Ended',
    duration: 'Duration',
    minutes: 'min',
    inProgress: 'In progress',
    status: 'Status',
    modules: 'Modules',
    blocks: 'Blocks',
    signature: 'Signature',
    backToDashboard: '← Back to home',
    statusLabels: {
      planning: 'Planning',
      en_route: 'En route',
      in_line: 'In line',
      crossing: 'Crossing',
      completed: 'Completed',
      abandoned: 'Cancelled',
    } as Record<string, string>,
  }

  return (
    <main className={`min-h-screen ${isIosApp ? 'pt-safe' : ''} bg-gray-50 dark:bg-gray-950 px-4 py-6`}>
      <div className="max-w-md mx-auto">
        <div className="mb-4">
          <Link href="/dashboard" className="text-xs text-blue-600 hover:underline">
            {t.backToDashboard}
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.title}</p>
          <h1 className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight">
            {portName}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 font-mono">{t.fromTo}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">{t.started}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {startedDate.toLocaleString(es ? 'es-MX' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
            {endedDate && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">{t.ended}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {endedDate.toLocaleString(es ? 'es-MX' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">{t.duration}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {durationMin != null ? `${durationMin} ${t.minutes}` : t.inProgress}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">{t.status}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t.statusLabels[row.status] ?? row.status}
              </p>
            </div>
          </div>

          {row.modules_present.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{t.modules}</p>
              <div className="flex flex-wrap gap-1.5">
                {row.modules_present.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {row.signature && (
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">{t.signature}</p>
              <p className="text-[10px] font-mono break-all text-gray-500 mt-1">
                {row.signature.slice(0, 24)}…{row.signature.slice(-12)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">key: {row.signing_key_id}</p>
            </div>
          )}
        </div>

        <details className="mt-4 text-xs text-gray-500">
          <summary className="cursor-pointer">JSON</summary>
          <pre className="mt-2 p-3 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-auto text-[10px]">
            {JSON.stringify(row.blocks, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  )
}
