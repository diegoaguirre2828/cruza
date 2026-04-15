'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Bell, Video, History, Route, Mail, Target, Star, TrendingDown } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// Post-Stripe-upgrade Pro walkthrough. Fires exactly once on
// /dashboard when the user returns from a successful checkout
// (?upgraded=pro). Deeper than the PostWelcomeTour because Pro users
// are paying — they deserve to see every feature they just unlocked
// so they don't forget and churn. Diego 2026-04-15: "after people press
// claim my pro, the walkthrough of the app and its features should be
// presented, so that way people arent missing out."
//
// Card order maps to what a returning daily commuter values most:
//   1. Alerts            — the headline Pro feature, set one immediately
//   2. Best time to cross — quiet-mode Pro win
//   3. Hourly history     — trust-building data layer
//   4. Route optimizer    — "best crossing right now" answer
//   5. Live cameras       — retention hook, people love cameras
//   6. Weekly digest      — sets email expectation so first one isn't spam
//   7. Favorites          — pro users cross the same bridges, save them
//   8. Rank up            — feed back into the Guardian loop even on Pro
//
// Dismiss via X or "Done." localStorage flag sticks, tour never
// refires. Triggered by ?upgraded=pro, which the Stripe success URL
// appends via stripe_success route.

const STORAGE_KEY = 'cruzar_post_upgrade_tour_v1'

interface Card {
  Icon: React.ComponentType<{ className?: string }>
  accent: string
  titleEs: string
  titleEn: string
  bodyEs: string
  bodyEn: string
  ctaEs: string
  ctaEn: string
  href?: string
}

const CARDS: Card[] = [
  {
    Icon: Bell,
    accent: 'from-blue-500 to-indigo-600',
    titleEs: 'Configura tu primera alerta',
    titleEn: 'Set up your first alert',
    bodyEs: 'Escoge un puente y te avisamos al teléfono cuando la fila baje a tu umbral. Funciona en segundo plano — no hay que tener la app abierta.',
    bodyEn: 'Pick a bridge and we ping your phone when the wait drops below your threshold. Runs in the background — no need to keep the app open.',
    ctaEs: 'Crear alerta',
    ctaEn: 'Create alert',
    href: '/dashboard?tab=alerts',
  },
  {
    Icon: TrendingDown,
    accent: 'from-emerald-500 to-teal-600',
    titleEs: 'Mejor hora pa\' cruzar',
    titleEn: 'Best time to cross',
    bodyEs: 'En cada puente ahora ves un chip verde con la mejor hora del día, calculada con 30 días de datos. Úsalo pa\' planear tu día.',
    bodyEn: 'Every bridge now shows a green chip with the best hour of the day, computed from 30 days of data. Plan your day around it.',
    ctaEs: 'Siguiente',
    ctaEn: 'Next',
  },
  {
    Icon: History,
    accent: 'from-amber-500 to-orange-600',
    titleEs: 'Historial por hora del día',
    titleEn: 'Hourly pattern history',
    bodyEs: 'Cada puente tiene una gráfica del patrón típico por hora del día. Verde = rápido, rojo = lento. Aprende cuándo NO ir.',
    bodyEn: "Every bridge has a typical hour-by-hour chart. Green = fast, red = slow. Learn when NOT to go.",
    ctaEs: 'Siguiente',
    ctaEn: 'Next',
  },
  {
    Icon: Route,
    accent: 'from-purple-500 to-fuchsia-600',
    titleEs: 'Optimizador de ruta',
    titleEn: 'Route optimizer',
    bodyEs: 'Dinos de dónde sales y te decimos cuál puente cruzar ahorita pa\' llegar más rápido. Compara todos los puentes en segundos.',
    bodyEn: "Tell us where you're leaving from and we pick the fastest bridge for you right now. Compares every crossing in seconds.",
    ctaEs: 'Probar ruta',
    ctaEn: 'Try routing',
    href: '/dashboard?tab=route',
  },
  {
    Icon: Video,
    accent: 'from-red-500 to-pink-600',
    titleEs: 'Cámaras en vivo del puente',
    titleEn: 'Live bridge cameras',
    bodyEs: 'Los puentes con cámara ahora te muestran el video en vivo arriba del tiempo. Confirma con tus ojos antes de salir.',
    bodyEn: 'Bridges with cameras now stream live video above the wait time. See the line with your own eyes before you leave.',
    ctaEs: 'Siguiente',
    ctaEn: 'Next',
  },
  {
    Icon: Mail,
    accent: 'from-sky-500 to-cyan-600',
    titleEs: 'Resumen semanal',
    titleEn: 'Weekly digest',
    bodyEs: 'Cada lunes 8am te mandamos un email con los mejores y peores horarios de tus puentes de la semana pasada. Abrelo, no es spam.',
    bodyEn: 'Every Monday at 8am we email you the best and worst hours of your bridges from last week. It lands in your inbox — not spam.',
    ctaEs: 'Siguiente',
    ctaEn: 'Next',
  },
  {
    Icon: Star,
    accent: 'from-yellow-500 to-amber-600',
    titleEs: 'Guarda tus puentes',
    titleEn: 'Save your bridges',
    bodyEs: 'Toca la estrella de cualquier puente pa\' guardarlo. Los favoritos salen arriba en la lista principal — los demás puentes quedan atrás.',
    bodyEn: "Tap the star on any bridge to save it. Favorites show at the top of the main list — everything else drops below.",
    ctaEs: 'Ver puentes',
    ctaEn: 'Browse bridges',
    href: '/',
  },
  {
    Icon: Target,
    accent: 'from-green-500 to-emerald-600',
    titleEs: 'Ganas puntos reportando',
    titleEn: 'Earn points by reporting',
    bodyEs: 'Cuando cruzas, repórtalo en segundos — ganas puntos, subes en el ranking de Guardián de tu zona, y ayudas a todos los demás.',
    bodyEn: 'Report your wait when you cross — you earn points, climb the Guardian ranking in your region, and help everyone else crossing today.',
    ctaEs: '¡Listo!',
    ctaEn: "Let's go!",
  },
]

export function PostUpgradeTour() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
      const params = new URLSearchParams(window.location.search)
      const upgraded = params.get('upgraded')
      // Fires on any successful upgrade. 'true' covers legacy checkouts
      // from before success_url was parameterized with the tier name.
      if (upgraded === 'pro' || upgraded === 'business' || upgraded === 'true') {
        setVisible(true)
        // Scrub the query param so a refresh or nav back doesn't refire.
        const url = new URL(window.location.href)
        url.searchParams.delete('upgraded')
        window.history.replaceState({}, '', url.pathname + (url.search || ''))
      }
    } catch { /* ignore */ }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setVisible(false)
  }

  function next() {
    if (step < CARDS.length - 1) setStep((s) => s + 1)
    else dismiss()
  }

  if (!visible) return null

  const card = CARDS[step]
  const isLast = step === CARDS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />

      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Accent header */}
        <div className={`bg-gradient-to-br ${card.accent} px-6 pt-5 pb-6 text-white relative overflow-hidden`}>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <button
            type="button"
            onClick={dismiss}
            aria-label={es ? 'Cerrar' : 'Dismiss'}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 rounded-full px-2 py-0.5">
                PRO · {step + 1}/{CARDS.length}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <card.Icon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-lg font-black leading-tight">
                  {es ? card.titleEs : card.titleEn}
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-5">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {es ? card.bodyEs : card.bodyEn}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-5">
          {CARDS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 bg-gray-900 dark:bg-gray-100'
                  : i < step
                    ? 'w-1.5 bg-gray-400 dark:bg-gray-500'
                    : 'w-1.5 bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pt-4 pb-6 flex gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-semibold"
          >
            {es ? 'Saltar' : 'Skip'}
          </button>
          {card.href ? (
            <Link
              href={card.href}
              onClick={dismiss}
              className="flex-[2] py-3 rounded-2xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-black text-center"
            >
              {es ? card.ctaEs : card.ctaEn}
            </Link>
          ) : (
            <button
              type="button"
              onClick={next}
              className="flex-[2] py-3 rounded-2xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-black"
            >
              {isLast ? (es ? '¡Listo!' : 'Done!') : es ? card.ctaEs : card.ctaEn}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
