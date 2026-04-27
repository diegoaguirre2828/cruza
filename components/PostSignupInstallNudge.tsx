'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift, X } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Persistent install nudge for SIGNED-IN users without the PWA. The
// founding-member promo (lifetime Pro for the first 1000) used to fire
// on bare signup — Diego killed that on 2026-04-26 ("seems like we are
// just giving pro away") and gated it to actual PWA install via
// /api/user/claim-pwa-pro. Once the promo is gated, we need a stronger
// post-signup install push.
//
// Visibility:
//   - signed-in user
//   - tier !== 'business' (they have their own UI)
//   - NOT running as standalone PWA
//   - dismiss flag not set within last 24h
//
// Bottom-sticky banner above the BottomNav. Dismissable but re-fires
// daily because the carrot is huge (lifetime Pro). Routes to /mas
// where the InstallGuide handles platform-specific install steps.

const DISMISS_KEY = 'cruzar_post_signup_install_dismissed_at'
const DISMISS_HOURS = 24

export function PostSignupInstallNudge() {
  const { user, loading: authLoading } = useAuth()
  const { tier } = useTier()
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (tier === 'business') return
    if (typeof window === 'undefined') return

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ageH = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60)
        if (ageH < DISMISS_HOURS) return
      }
    } catch { /* ignore */ }

    // Defer a beat so the home content paints first.
    const id = setTimeout(() => {
      setShow(true)
      trackEvent('post_signup_install_nudge_shown')
    }, 800)
    return () => clearTimeout(id)
  }, [user, authLoading, tier])

  function dismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    trackEvent('post_signup_install_nudge_dismissed')
    setShow(false)
  }

  if (!show) return null

  return (
    <Link
      href="/mas"
      onClick={() => trackEvent('post_signup_install_nudge_tapped')}
      className="fixed left-3 right-3 z-40 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-600 px-3 py-2.5 shadow-2xl active:scale-[0.99] transition-transform"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/25 flex items-center justify-center">
        <Gift className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-white leading-tight">
          {es ? '🎁 Pro de por vida — instala la app' : '🎁 Lifetime Pro — install the app'}
        </p>
        <p className="text-[10px] text-white/90 mt-0.5 leading-snug">
          {es
            ? 'Primeros 1,000 que se registren e instalen · alertas + cámaras + favoritos'
            : 'First 1,000 to sign up + install · alerts + cameras + favorites'}
        </p>
      </div>
      <span className="flex-shrink-0 bg-white text-orange-600 text-[11px] font-black px-3 py-1.5 rounded-full whitespace-nowrap">
        {es ? 'Cómo' : 'How'}
      </span>
      <button
        type="button"
        aria-label={es ? 'Cerrar' : 'Dismiss'}
        onClick={dismiss}
        className="flex-shrink-0 text-white/70 hover:text-white p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </Link>
  )
}
