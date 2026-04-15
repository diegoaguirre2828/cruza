'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// 4-screen post-welcome tour. Fires exactly once on /dashboard when the
// user arrives from /welcome (?welcomed=1). Purpose: surface the
// features that are buried 2+ taps deep (circles, reports/guardian)
// while the user is already in a "just finished setup, what's next"
// mood.
//
// Card order matches the natural retention ladder:
//   1. Saved bridge     — celebrate the setup they just did
//   2. Alerts           — remind them push is wired up
//   3. Circles          — teach the Life360 feature (biggest surfacing gap)
//   4. Reports          — recruit them into the Guardian loop
//
// Dismissible via X or "Skip." Once dismissed or completed, the
// localStorage flag sticks and the tour never re-fires. Survives route
// changes because it lives inside /dashboard.

const STORAGE_KEY = 'cruzar_post_welcome_tour_v1'

interface Card {
  emoji: string
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
    emoji: '⭐',
    titleEs: 'Tu puente está guardado',
    titleEn: 'Your bridge is saved',
    bodyEs: 'Lo vas a ver arriba cada vez que abras Cruzar, con el tiempo en vivo.',
    bodyEn: "You'll see it at the top every time you open Cruzar, with live wait time.",
    ctaEs: 'Siguiente',
    ctaEn: 'Next',
  },
  {
    emoji: '🔔',
    titleEs: 'Las alertas ya están activas',
    titleEn: 'Your alerts are on',
    bodyEs: 'Te avisamos al teléfono cuando la fila baje — sin tener que andar chequeando.',
    bodyEn: "We'll ping your phone when the line drops — no more checking.",
    ctaEs: 'Siguiente',
    ctaEn: 'Next',
  },
  {
    emoji: '👥',
    titleEs: 'Invita a tu gente',
    titleEn: 'Invite your people',
    bodyEs: 'Crea un círculo y tu mamá, esposa e hijos saben cuando cruzas — sin mensajes.',
    bodyEn: 'Create a circle and mom, spouse, and kids know when you cross — no texts.',
    ctaEs: 'Crear círculo',
    ctaEn: 'Create circle',
    href: '/dashboard?tab=circle',
  },
  {
    emoji: '🏆',
    titleEs: 'Vuélvete Guardián',
    titleEn: 'Become a Guardian',
    bodyEs: 'Reporta tu espera en el puente y ganas puntos + rango en tu región.',
    bodyEn: 'Report your wait at the bridge to earn points and rank in your region.',
    ctaEs: 'Listo',
    ctaEn: 'Done',
  },
]

export function PostWelcomeTour() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
      const params = new URLSearchParams(window.location.search)
      if (params.get('welcomed') === '1') {
        setVisible(true)
        window.history.replaceState({}, '', '/dashboard')
      }
    } catch { /* ignore */ }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setVisible(false)
  }

  function next() {
    if (step < CARDS.length - 1) {
      setStep((s) => s + 1)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  const card = CARDS[step]
  const isLast = step === CARDS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={dismiss} />

      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl px-6 pt-6 pb-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={es ? 'Cerrar' : 'Dismiss'}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center gap-1.5 mb-5">
          {CARDS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 bg-blue-500'
                  : i < step
                    ? 'w-1.5 bg-blue-300'
                    : 'w-1.5 bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        <div className="text-center">
          <div className="text-6xl mb-4">{card.emoji}</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {es ? card.titleEs : card.titleEn}
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
            {es ? card.bodyEs : card.bodyEn}
          </p>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-base font-semibold"
          >
            {es ? 'Saltar' : 'Skip'}
          </button>
          {card.href ? (
            <Link
              href={card.href}
              onClick={dismiss}
              className="flex-[2] py-3.5 rounded-2xl bg-blue-600 text-white text-base font-bold text-center"
            >
              {es ? card.ctaEs : card.ctaEn}
            </Link>
          ) : (
            <button
              type="button"
              onClick={next}
              className="flex-[2] py-3.5 rounded-2xl bg-blue-600 text-white text-base font-bold"
            >
              {isLast ? (es ? '¡Listo!' : 'Done!') : es ? card.ctaEs : card.ctaEn}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
