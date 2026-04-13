'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { InstallGuide } from './InstallGuide'

// Persistent nag banner for signed-in users who haven't installed the
// PWA yet. Frames the install as finishing setup, not starting something
// new — "your alert is waiting, finish setup to receive it." On iOS,
// this is literally true: without install, push notifications can't fire.
//
// Dismissible for 24h. Re-appears daily until installed because the
// functional necessity doesn't go away.

const DISMISS_KEY = 'cruzar_dashboard_install_dismissed'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000

export function DashboardInstallBanner() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_TTL_MS) return
    } catch { /* ignore */ }

    setShow(true)
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="mb-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl overflow-hidden">
      <div className="px-4 py-3.5 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 leading-none">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight">
            {es ? 'Tu alerta está esperando' : 'Your alert is waiting'}
          </p>
          <p className="text-[11px] text-gray-700 dark:text-gray-300 mt-0.5 leading-snug">
            {es
              ? 'Instala Cruzar en tu pantalla de inicio pa\' que la alerta te llegue. En iPhone no llega si no instalas.'
              : "Install Cruzar to your home screen so the alert can reach you. On iPhone it won't arrive otherwise."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline"
            >
              {expanded
                ? (es ? 'Ocultar' : 'Hide')
                : (es ? 'Mostrarme cómo →' : 'Show me how →')}
            </button>
            <button
              onClick={dismiss}
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {es ? 'Después' : 'Later'}
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-amber-200 dark:border-amber-800">
          <InstallGuide variant="banner" onInstalled={dismiss} />
        </div>
      )}
    </div>
  )
}
