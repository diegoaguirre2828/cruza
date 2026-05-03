'use client'

import { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { Bell, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { tapLight, tapSuccess, tapWarning } from '@/lib/haptics'
import { trackEvent } from '@/lib/trackEvent'

interface Props {
  portId: string
  portName: string
}

const VISIT_KEY = (portId: string) => `cruzar_pd_visits_${portId}`
const NUDGE_DISMISSED_KEY = (portId: string) => `cruzar_first_alert_nudge_${portId}`
const DEFAULT_THRESHOLD = 30

// First-Alert Nudge — fires the first time a user lands on a bridge
// detail page for the SECOND time, OR right after favoriting. One
// decision: "ping me when it drops to <30 min?" Yes → POSTs alert +
// auto-grants push if not subscribed. No threshold thinking, no chip
// tapping. Diego 2026-05-02: "should be a simple step process not
// something they have to think too much about."

export function FirstAlertNudge({ portId, portName }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const { user } = useAuth()
  const { supported, subscribed, subscribe } = usePushNotifications()

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!user) return
    try {
      const dismissed = localStorage.getItem(NUDGE_DISMISSED_KEY(portId)) === '1'
      if (dismissed) return
      const raw = localStorage.getItem(VISIT_KEY(portId))
      const visits = raw ? parseInt(raw, 10) || 0 : 0
      const next = visits + 1
      localStorage.setItem(VISIT_KEY(portId), String(next))
      if (next === 2) {
        // Don't fire if user already has any alert preferences (would
        // mean they figured it out already). Lightweight check.
        fetch('/api/alerts', { cache: 'no-store', credentials: 'include' })
          .then(r => r.ok ? r.json() : { alerts: [] })
          .then((data: { alerts?: { port_id: string }[] }) => {
            const hasAny = (data.alerts ?? []).some(a => a.port_id === portId)
            if (!hasAny) {
              setOpen(true)
              trackEvent('first_alert_nudge_shown', { port_id: portId })
            }
          })
          .catch(() => { /* silent */ })
      }
    } catch { /* ignore */ }
  }, [portId, user])

  function dismiss() {
    try { localStorage.setItem(NUDGE_DISMISSED_KEY(portId), '1') } catch {}
    setOpen(false)
    trackEvent('first_alert_nudge_dismissed', { port_id: portId })
  }

  async function accept() {
    setSubmitting(true)
    tapLight()
    trackEvent('first_alert_nudge_accepted', { port_id: portId })
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId, laneType: 'vehicle', thresholdMinutes: DEFAULT_THRESHOLD }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        tapSuccess()
        toast.success(
          es ? `Listo · te avisamos cuando ${portName} baje de ${DEFAULT_THRESHOLD} min` : `Set · we'll ping you when ${portName} drops below ${DEFAULT_THRESHOLD} min`,
          { duration: 4000 },
        )
        try { localStorage.setItem(NUDGE_DISMISSED_KEY(portId), '1') } catch {}
        if (supported && !subscribed) {
          // Auto-prompt push grant in the same flow so the alert can
          // actually deliver. Skip silently if user denies — alert row
          // still exists, will fire via email if they configured it.
          subscribe().catch(() => {})
        }
        setOpen(false)
      } else if (data?.error === 'free_limit' || data?.error === 'tier_limit') {
        toast.warning(es ? 'Ya tienes una alerta · sube a Pro pa\' más' : 'You already have an alert · upgrade to Pro for more', { duration: 4000 })
        try { localStorage.setItem(NUDGE_DISMISSED_KEY(portId), '1') } catch {}
        tapWarning()
        setOpen(false)
      } else {
        toast.error(es ? 'No se pudo activar' : 'Could not activate')
        tapWarning()
      }
    } catch {
      toast.error(es ? 'No se pudo activar' : 'Could not activate')
      tapWarning()
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) dismiss() }} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[61] mt-24 flex h-auto flex-col rounded-t-3xl bg-white dark:bg-gray-900 outline-none focus:outline-none"
          style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <Drawer.Title className="sr-only">
            {es ? `Activa alerta para ${portName}` : `Set alert for ${portName}`}
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            {es ? 'Una decisión: te avisamos cuando este puente baje.' : 'One decision: we ping you when this bridge drops.'}
          </Drawer.Description>

          <div className="mx-auto my-3 h-1.5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />

          <div className="px-5 pb-4">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  {es ? 'Alertas' : 'Alerts'}
                </p>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight font-display truncate">
                  {portName}
                </h3>
              </div>
            </div>

            <p className="text-base text-gray-800 dark:text-gray-200 leading-snug mb-5">
              {es
                ? <>¿Quieres que <span className="font-bold">te avisemos</span> cuando este puente baje de <span className="font-bold tabular-nums">{DEFAULT_THRESHOLD} min</span>?</>
                : <>Want a <span className="font-bold">ping</span> when this bridge drops below <span className="font-bold tabular-nums">{DEFAULT_THRESHOLD} min</span>?</>}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={dismiss}
                className="py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-sm active:scale-[0.97] transition-transform"
              >
                {es ? 'Después' : 'Later'}
              </button>
              <button
                onClick={accept}
                disabled={submitting}
                className="py-3.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-sm disabled:opacity-60 active:scale-[0.97] transition-transform shadow-lg shadow-blue-600/30 inline-flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                {submitting ? '…' : (es ? 'Sí, avísame' : 'Yes, ping me')}
              </button>
            </div>

            <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 text-center leading-snug">
              {es ? 'Puedes ajustar el tiempo en cualquier momento desde el icono 🔔.' : 'Tune the threshold any time from the 🔔 icon.'}
            </p>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
