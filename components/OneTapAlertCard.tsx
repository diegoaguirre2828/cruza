'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { trackEvent } from '@/lib/trackEvent'
import { PORT_META } from '@/lib/portMeta'

// One-tap alert setup card for the Mi puente panel. Reads the user's
// favorite bridge, checks if they already have an alert, and renders
// a single CTA that posts to /api/alerts directly. Skips the
// /dashboard?tab=alerts trip that was eating most of the activation
// (3.4% alert rate as of 2026-04-18).
//
// Threshold default: 30 min. Most users never customize it; the rest
// can tweak after on /dashboard.

const DEFAULT_THRESHOLD = 30

interface Props {
  favoritePortId: string
  tier: string
}

type State = 'loading' | 'idle' | 'has_alert' | 'submitting' | 'success' | 'limit' | 'error'

export function OneTapAlertCard({ favoritePortId, tier }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    fetchWithTimeout('/api/alerts', { cache: 'no-store' }, 5000)
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((data) => {
        const alerts: { port_id: string }[] = Array.isArray(data?.alerts) ? data.alerts : []
        const hasForFav = alerts.some((a) => a.port_id === favoritePortId)
        setState(hasForFav ? 'has_alert' : 'idle')
      })
      .catch(() => setState('idle'))
  }, [favoritePortId])

  async function setAlert() {
    setState('submitting')
    trackEvent('one_tap_alert_tapped', { port_id: favoritePortId, tier })
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portId: favoritePortId,
          laneType: 'vehicle',
          thresholdMinutes: DEFAULT_THRESHOLD,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setState('success')
        trackEvent('one_tap_alert_created', { port_id: favoritePortId, tier })
      } else if (data?.error === 'free_limit') {
        setState('limit')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'loading' || state === 'has_alert') return null

  const meta = PORT_META[favoritePortId]
  const portName = meta?.localName || meta?.city || 'tu puente'

  if (state === 'success') {
    return (
      <Link
        href="/dashboard?tab=alerts"
        className="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 active:scale-[0.99] transition-transform"
      >
        <BellRing className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 leading-tight">
            {es ? '✅ Alerta activada' : '✅ Alert is set'}
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 leading-snug">
            {es
              ? `Te avisamos cuando ${portName} baje de ${DEFAULT_THRESHOLD} min`
              : `We'll ping you when ${portName} drops below ${DEFAULT_THRESHOLD} min`}
          </p>
        </div>
        <span className="flex-shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
          {es ? 'Ajustar' : 'Tune'}
        </span>
      </Link>
    )
  }

  if (state === 'limit') {
    return (
      <Link
        href="/pricing"
        className="mt-3 flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 active:scale-[0.99] transition-transform"
      >
        <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-tight">
            {es ? 'Ya tienes 1 alerta gratis' : 'You already have 1 free alert'}
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-snug">
            {es ? 'Sube a Pro para alertas en todos tus puentes' : 'Upgrade to Pro for alerts on every bridge'}
          </p>
        </div>
        <span className="flex-shrink-0 bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
          {es ? 'Ver Pro' : 'See Pro'}
        </span>
      </Link>
    )
  }

  const isPro = tier === 'pro' || tier === 'business'
  const helper = isPro
    ? (es ? 'Te avisamos antes de salir.' : "We'll ping you before you leave.")
    : (es ? '1 alerta gratis · sube a Pro pa\' más' : '1 free alert · go Pro for more')

  return (
    <button
      type="button"
      onClick={setAlert}
      disabled={state === 'submitting' || state === 'error'}
      className="mt-3 w-full flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 active:scale-[0.99] transition-transform disabled:opacity-60"
    >
      <Bell className="w-5 h-5 text-white flex-shrink-0" />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-black text-white leading-tight">
          {state === 'error'
            ? (es ? '⚠️ No se pudo activar' : '⚠️ Could not set alert')
            : (es
              ? `🔔 Avisarme cuando ${portName} baje de 30 min`
              : `🔔 Ping me when ${portName} drops below 30 min`)}
        </p>
        <p className="text-[11px] text-blue-100 mt-0.5 leading-snug">{helper}</p>
      </div>
      <span className="flex-shrink-0 bg-white text-blue-700 text-[11px] font-black px-3 py-1.5 rounded-full whitespace-nowrap">
        {state === 'submitting' ? '…' : (es ? 'Activar' : 'Set')}
      </span>
    </button>
  )
}
