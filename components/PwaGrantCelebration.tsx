'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// Fix C from the 2026-04-14 PWA funnel audit.
//
// Full-screen celebration modal that fires when the user's PWA Pro
// grant is successfully claimed. Listens for the window event
// `cruzar:pwa-grant-claimed` dispatched by PWASetup and ClaimProInPwa.
// Before this component existed, the event had zero listeners so
// even users who DID successfully claim Pro never knew they had it.
//
// Shows once per successful claim. localStorage dedupe so a refresh
// doesn't re-trigger. User-tapped acknowledgment dismisses.
//
// Rendered in app/layout.tsx globally so it works on any page where
// a claim might fire.

const CELEBRATION_SEEN_KEY = 'cruzar_pwa_celebration_seen'

export function PwaGrantCelebration() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [days, setDays] = useState<number | null>(null)
  // alertCount === null means we haven't checked yet. Once checked,
  // 0 → push the user straight into the alert-setup flow (retention
  // lever #1: the single biggest predictor of a returning user is
  // whether they have an active alert). >0 → keep the generic
  // dashboard CTA since they already have the hook.
  const [alertCount, setAlertCount] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = async (event: Event) => {
      const detail = (event as CustomEvent<{ days?: number }>).detail
      try {
        if (localStorage.getItem(CELEBRATION_SEEN_KEY)) return
      } catch { /* ignore */ }
      setDays(detail?.days ?? 90)
      setShow(true)
      // Fetch alert count so the CTA can deep-link to the create-alert
      // flow for users who haven't set one up yet. Non-blocking — if
      // this fails we fall back to the generic /dashboard link.
      try {
        const res = await fetch('/api/alerts', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const count = Array.isArray(data?.alerts) ? data.alerts.length : 0
          setAlertCount(count)
        } else {
          setAlertCount(0)
        }
      } catch {
        setAlertCount(0)
      }
    }

    window.addEventListener('cruzar:pwa-grant-claimed', handler)
    return () => window.removeEventListener('cruzar:pwa-grant-claimed', handler)
  }, [])

  function dismiss() {
    try { localStorage.setItem(CELEBRATION_SEEN_KEY, String(Date.now())) } catch {}
    setShow(false)
  }

  if (!show) return null

  const unlocks = [
    { es: 'Alertas push cuando baje tu puente', en: 'Push alerts when your bridge drops' },
    { es: 'Cámaras en vivo de los puentes', en: 'Live bridge cameras' },
    { es: 'Patrón por hora de los últimos 30 días', en: 'Hourly pattern from the last 30 days' },
    { es: 'Mejor hora pa\' cruzar (basado en tus datos)', en: 'Best hour to cross (based on your data)' },
    { es: 'Optimizador de ruta', en: 'Route optimizer' },
    { es: 'Predicciones por hora', en: 'Hourly predictions' },
  ]

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm bg-gradient-to-br from-amber-400 via-orange-500 to-pink-600 text-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-white/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-64 h-64 bg-pink-300/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6 text-center">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <p className="text-3xl leading-none mb-1">🎉</p>
          <h2 className="text-2xl font-black leading-tight mt-1">
            {es ? '¡Pro desbloqueado!' : 'Pro unlocked!'}
          </h2>
          <p className="text-sm font-semibold text-white/95 mt-1">
            {es
              ? `${days ?? 90} días gratis por agregar Cruzar a tu pantalla de inicio`
              : `${days ?? 90} days free for adding Cruzar to your home screen`}
          </p>

          <div className="mt-5 bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-left border border-white/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-2">
              {es ? 'Lo que desbloqueaste' : 'What you unlocked'}
            </p>
            <ul className="space-y-1.5">
              {unlocks.map((u, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                  <span className="text-white mt-0.5">✓</span>
                  <span>{es ? u.es : u.en}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={alertCount === 0 ? '/dashboard?tab=alerts&from=pwa' : '/dashboard'}
              onClick={dismiss}
              className="w-full bg-white text-orange-600 font-black py-3 rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
            >
              {alertCount === 0
                ? (es ? 'Crea tu primera alerta →' : 'Create your first alert →')
                : (es ? 'Empezar a usar Pro →' : 'Start using Pro →')}
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="text-[11px] text-white/80 hover:text-white py-1"
            >
              {es ? 'Seguir explorando' : 'Keep exploring'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
