'use client'

import { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { Bell, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useLang } from '@/lib/LangContext'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { trackEvent } from '@/lib/trackEvent'
import { tapLight, tapSelection, tapSuccess, tapWarning } from '@/lib/haptics'

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

  async function submit() {
    setState('submitting')
    tapLight()
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
        tapSuccess()
        toast.success(
          es ? `Alerta lista a ${threshold} min` : `Alert set at ${threshold} min`,
          { description: portName, duration: 3000 }
        )
        trackEvent('bridge_alert_sheet_success', { port_id: portId, threshold })
        setTimeout(onClose, 800)
      } else if (data?.error === 'free_limit' || data?.error === 'tier_limit') {
        setState('cap')
        tapWarning()
      } else {
        setState('error')
        tapWarning()
      }
    } catch {
      setState('error')
      tapWarning()
    }
  }

  function pickThreshold(t: number) {
    if (t === threshold) return
    tapSelection()
    setThreshold(t)
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      shouldScaleBackground
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[61] mt-24 flex h-auto flex-col rounded-t-3xl bg-white dark:bg-gray-900 outline-none focus:outline-none"
          style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <Drawer.Title className="sr-only">
            {es ? `Configurar alerta para ${portName}` : `Configure alert for ${portName}`}
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            {es
              ? 'Elige cuándo te avisamos y activa notificaciones push.'
              : 'Pick a threshold and enable push notifications.'}
          </Drawer.Description>

          {/* Drag handle */}
          <div className="mx-auto my-3 h-1.5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />

          <div className="px-5 pb-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight truncate font-display">
                  {portName}
                </h3>
                <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 mt-0.5">
                  {es ? 'Avísame cuando baje de' : 'Ping me when it drops below'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {THRESHOLDS.map(t => (
                <button
                  key={t}
                  onClick={() => pickThreshold(t)}
                  className={`py-3 rounded-xl text-sm font-bold border transition-all duration-150 active:scale-95 ${
                    threshold === t
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                  }`}
                >
                  <span className="font-mono tabular-nums">{t}</span>
                  <span className="text-[10px] font-medium opacity-70 ml-0.5">m</span>
                </button>
              ))}
            </div>

            {supported && !subscribed && (
              <button
                onClick={() => { tapLight(); subscribe() }}
                disabled={pushLoading}
                className="w-full mb-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold disabled:opacity-60 active:scale-[0.99] transition-transform"
              >
                {pushLoading
                  ? (es ? 'Conectando…' : 'Connecting…')
                  : (es ? '🔔 Activar notificaciones primero' : '🔔 Enable push first')}
              </button>
            )}

            {state === 'success' ? (
              <div className="w-full py-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2 text-emerald-900 dark:text-emerald-100 font-bold text-sm">
                <Check className="w-5 h-5" strokeWidth={3} />
                {es ? `Lista a ${threshold} min` : `Set at ${threshold} min`}
              </div>
            ) : state === 'cap' ? (
              <a
                href="/pricing"
                onClick={() => tapLight()}
                className="block w-full py-3.5 rounded-xl bg-amber-500 text-white font-bold text-sm text-center active:scale-[0.99] transition-transform"
              >
                {es ? 'Ya tienes 1 alerta · Sube a Pro' : 'You have 1 alert · Upgrade to Pro'}
              </a>
            ) : (
              <button
                onClick={submit}
                disabled={state === 'submitting'}
                className="w-full py-3.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-sm disabled:opacity-60 active:scale-[0.99] transition-transform shadow-lg shadow-blue-600/30"
              >
                {state === 'submitting'
                  ? '…'
                  : state === 'error'
                    ? (es ? '⚠️ Reintentar' : '⚠️ Retry')
                    : hasAlert
                      ? (es ? `Actualizar a ${threshold} min` : `Update to ${threshold} min`)
                      : (es ? `Activar a ${threshold} min` : `Set alert at ${threshold} min`)}
              </button>
            )}

            {!supported && (
              <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 text-center leading-snug">
                {es
                  ? 'Tu dispositivo no soporta push. Instala la app desde "Compartir" para activarlas.'
                  : 'Your device doesn\'t support push yet. Install from "Share" to enable it.'}
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
