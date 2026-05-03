'use client'

import { useEffect, useState } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { trackEvent } from '@/lib/trackEvent'

const THRESHOLDS = [15, 30, 45, 60, 90]

interface Props {
  open: boolean
  onClose: () => void
  portId: string
  portName: string
}

type State = 'idle' | 'submitting' | 'success' | 'cap' | 'error'

export function BridgeAlertSheet({ open, onClose, portId, portName }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const { supported, subscribed, subscribe, loading: pushLoading } = usePushNotifications()
  const [hasAlert, setHasAlert] = useState<boolean>(false)
  const [threshold, setThreshold] = useState(30)
  const [state, setState] = useState<State>('idle')

  useEffect(() => {
    if (!open) return
    setState('idle')
    fetch('/api/alerts', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { alerts: [] }))
      .then((data: { alerts?: { port_id: string; threshold_minutes: number }[] }) => {
        const existing = (data.alerts ?? []).find(a => a.port_id === portId)
        setHasAlert(!!existing)
        if (existing) setThreshold(existing.threshold_minutes)
      })
      .catch(() => setHasAlert(false))
  }, [open, portId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  async function submit() {
    setState('submitting')
    trackEvent('bridge_alert_sheet_submit', { port_id: portId, threshold })
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId, laneType: 'vehicle', thresholdMinutes: threshold }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setState('success')
        trackEvent('bridge_alert_sheet_success', { port_id: portId, threshold })
        setTimeout(onClose, 1200)
      } else if (data?.error === 'free_limit' || data?.error === 'tier_limit') {
        setState('cap')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (!open) return null

  const showPushPrompt = supported && !subscribed

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={es ? 'Configurar alerta' : 'Configure alert'}
    >
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-5 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight truncate">
                {es ? 'Alerta' : 'Alert'} · {portName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {es ? 'Te avisamos cuando baje de:' : 'Ping me when it drops below:'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={es ? 'Cerrar' : 'Close'}
            className="p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {THRESHOLDS.map(t => (
            <button
              key={t}
              onClick={() => setThreshold(t)}
              className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                threshold === t
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'
              }`}
            >
              {t}m
            </button>
          ))}
        </div>

        {showPushPrompt && (
          <button
            onClick={subscribe}
            disabled={pushLoading}
            className="w-full mb-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold disabled:opacity-60"
          >
            {pushLoading
              ? (es ? 'Conectando…' : 'Connecting…')
              : (es ? '🔔 Activar notificaciones push primero' : '🔔 Enable push notifications first')}
          </button>
        )}

        {state === 'success' ? (
          <div className="w-full py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2 text-emerald-900 dark:text-emerald-100 font-bold text-sm">
            <Check className="w-5 h-5" />
            {es ? `Alerta lista a ${threshold} min` : `Alert set at ${threshold} min`}
          </div>
        ) : state === 'cap' ? (
          <a
            href="/pricing"
            className="block w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm text-center"
          >
            {es ? 'Ya tienes 1 alerta · Sube a Pro' : 'You already have 1 alert · Upgrade to Pro'}
          </a>
        ) : (
          <button
            onClick={submit}
            disabled={state === 'submitting'}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm disabled:opacity-60 active:scale-[0.99] transition-transform"
          >
            {state === 'submitting'
              ? '…'
              : state === 'error'
                ? (es ? '⚠️ Reintentar' : '⚠️ Retry')
                : hasAlert
                  ? (es ? `Actualizar a ${threshold} min` : `Update to ${threshold} min`)
                  : (es ? `Activar alerta a ${threshold} min` : `Set alert at ${threshold} min`)}
          </button>
        )}

        {!supported && (
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 text-center">
            {es
              ? 'Tu dispositivo no soporta push. Instala la app desde el menú "Compartir" para activarlas.'
              : 'Your device doesn\'t support push yet. Install the app from the Share menu to enable it.'}
          </p>
        )}
      </div>
    </div>
  )
}
