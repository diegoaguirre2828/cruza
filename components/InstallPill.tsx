'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useFoundingSlots } from '@/lib/useFoundingSlots'
import { useTier } from '@/lib/useTier'
import { isIosSafari } from '@/lib/iosDetect'

// Compact install CTA pill for the home header row. Shown whenever
// the app is NOT running as an installed PWA. Replaces the bottom-
// corner InstallPrompt modal we removed in Phase 1 — that was too
// easy to dismiss and most guests never signed up (so /welcome
// step 2 never fired for them), which killed install conversions.
//
// This pill is calm: single line, no modal, just a persistent
// reminder that tapping gets them the Pro bonus. Taps route to
// /mas where the full InstallGuide lives.

// How many days to hide the pill after the user explicitly dismisses
// it. Long enough that returning users aren't pestered every open,
// short enough that we catch high-intent visits (e.g. users who come
// back during a border incident). localStorage, not server — a
// dismiss on one device doesn't affect another, which is fine.
const DISMISS_DAYS = 7
const DISMISS_KEY = 'cruzar_install_pill_dismissed_at'

export function InstallPill() {
  const { lang } = useLang()
  const { full: capFull } = useFoundingSlots()
  const { tier } = useTier()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  // iOS Safari has no programmatic install path, so the pill targets
  // /ios-install (the focused 3-tap walkthrough) instead of /mas (the
  // kitchen-sink "more" page) — Diego flagged 2026-05-03 that iOS users
  // tap the pill, get instructions, and bounce because it feels like a
  // dead end. /mas remains the destination for Android (where the
  // PWA install path is more complex than a single Share-menu tap).
  const [iosWeb, setIosWeb] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) {
      setShow(false)
      return
    }
    // Already-paid users don't need the "Install · Pro carrot" pitch.
    // The pill is for Free/guest users where the install grant is the
    // actual value-add. Pro/Business users are pestered with copy
    // ("Install · 3mo Pro") that doesn't apply to them.
    if (tier === 'pro' || tier === 'business') {
      setShow(false)
      return
    }
    setIosWeb(isIosSafari())
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ageDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
        if (ageDays < DISMISS_DAYS) {
          setShow(false)
          return
        }
      }
    } catch { /* ignore */ }
    setShow(true)
  }, [tier])

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <Link
      href={iosWeb ? "/ios-install" : "/mas"}
      className="cruzar-pill inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-full pl-2 pr-1.5 py-1.5 max-w-full"
    >
      <span className="text-base leading-none">📲</span>
      <span className="text-[11px] font-black whitespace-nowrap">
        {capFull
          ? (es ? 'Instalar · 3 meses Pro' : 'Install · 3mo Pro')
          : (es ? 'Instalar · Pro de por vida' : 'Install · Lifetime Pro')}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={es ? 'Cerrar' : 'Dismiss'}
        className="ml-0.5 flex items-center justify-center w-5 h-5 rounded-full text-white/70 hover:text-white hover:bg-white/10 text-[13px] leading-none"
      >
        ×
      </button>
    </Link>
  )
}
