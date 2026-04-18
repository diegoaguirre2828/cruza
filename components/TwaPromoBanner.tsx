'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { isPwaInstalled } from '@/lib/iosDetect'
import { trackEvent } from '@/lib/trackEvent'

// Shows a compact "Cruzar is on Play Store now" banner to Android web
// users, bypassing the PWA install flow. Only renders when:
//   - NEXT_PUBLIC_TWA_PLAY_STORE_URL is set (flips on when TWA ships)
//   - User agent is Android (not iOS, not desktop)
//   - Not already in standalone/TWA mode
//   - Not already dismissed in the last 14 days
//
// Reason: once TWA is live, Play Store install is smoother on Android
// than the Chrome A2HS flow. iOS users stay on /ios-install since we
// have no App Store presence yet.

const DISMISS_KEY = 'cruzar_twa_banner_dismissed_at'
const DISMISS_DAYS = 14

export function TwaPromoBanner() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const playStoreUrl = process.env.NEXT_PUBLIC_TWA_PLAY_STORE_URL

  useEffect(() => {
    if (!playStoreUrl) return
    if (typeof navigator === 'undefined') return
    const isAndroid = /Android/i.test(navigator.userAgent || '')
    if (!isAndroid) return
    if (isPwaInstalled()) return
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (dismissed) {
        const ageDays = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24)
        if (ageDays < DISMISS_DAYS) return
      }
    } catch {}
    setShow(true)
    trackEvent('twa_banner_shown', { platform: 'android' })
  }, [playStoreUrl])

  if (!show || !playStoreUrl) return null

  const onInstall = () => {
    trackEvent('twa_banner_install_clicked', { platform: 'android' })
    window.open(playStoreUrl, '_blank', 'noopener')
  }

  const onDismiss = () => {
    trackEvent('twa_banner_dismissed', { platform: 'android' })
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setShow(false)
  }

  return (
    <div className="fixed bottom-16 left-2 right-2 z-40 sm:hidden">
      <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 text-white rounded-2xl shadow-xl p-3 flex items-center gap-3 relative">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">
          📱
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black leading-tight">
            {es ? 'Cruzar ya está en Play Store' : 'Cruzar is on Play Store'}
          </p>
          <p className="text-[11px] text-emerald-100 leading-snug mt-0.5">
            {es ? 'Instálala gratis · 3 meses Pro' : 'Install free · 3 months Pro'}
          </p>
        </div>
        <button
          onClick={onInstall}
          className="flex-shrink-0 bg-white text-emerald-700 font-black text-xs px-3 py-2 rounded-xl active:scale-95 transition-transform"
        >
          {es ? 'Instalar' : 'Install'}
        </button>
        <button
          onClick={onDismiss}
          aria-label={es ? 'Cerrar' : 'Dismiss'}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
