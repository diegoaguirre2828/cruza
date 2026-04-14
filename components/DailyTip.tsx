'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { getTipOfDay } from '@/lib/tips'
import { trackEvent } from '@/lib/trackEvent'

const DISMISS_KEY = 'cruzar_tip_dismissed_v1'

// Compact daily tip card. Visible for guests + free tier (the two
// audiences that actually need the advice — business users already
// know this stuff cold). Dismissable for the session so a user who
// already saw today's tip doesn't get nagged on every homepage visit.
// Fires daily_tip_shown + daily_tip_tapped + daily_tip_dismissed into
// the app_events pipeline so we can track which tips drive clicks.
//
// Two render variants:
//   - 'widget'   : standalone card with top margin + dismiss button
//                  (legacy home placement — not used anymore)
//   - 'carousel' : inline slide for the hero carousel. No top margin,
//                  no dismiss button (user swipes to the next slide
//                  instead of dismissing). No session-dismiss
//                  persistence — the tip is always visible when the
//                  user swipes to its slide.
export function DailyTip({ variant = 'widget' }: { variant?: 'widget' | 'carousel' } = {}) {
  const { lang } = useLang()
  const [dismissed, setDismissed] = useState(variant === 'widget')
  const [tip, setTip] = useState(() => getTipOfDay())
  const [tracked, setTracked] = useState(false)

  useEffect(() => {
    // Recompute on mount so SSR and client agree even across day
    // boundaries (rare but cheap).
    setTip(getTipOfDay())
    // Carousel variant never checks the dismiss flag — the tip is
    // always visible inside its slide and the user swipes away.
    if (variant === 'carousel') {
      setDismissed(false)
      return
    }
    try {
      const key = `${DISMISS_KEY}:${getTipOfDay().id}`
      setDismissed(sessionStorage.getItem(key) === '1')
    } catch {
      setDismissed(false)
    }
  }, [variant])

  useEffect(() => {
    if (dismissed || tracked) return
    trackEvent('daily_tip_shown', { tip_id: tip.id })
    setTracked(true)
  }, [dismissed, tracked, tip.id])

  if (dismissed) return null

  const text = lang === 'es' ? tip.es : tip.en
  const label = lang === 'es' ? '💡 Consejo del día' : '💡 Tip of the day'

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      sessionStorage.setItem(`${DISMISS_KEY}:${tip.id}`, '1')
    } catch { /* ignore */ }
    setDismissed(true)
    trackEvent('daily_tip_dismissed', { tip_id: tip.id })
  }

  const isCarousel = variant === 'carousel'

  const body = (
    <div
      className={`relative bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border border-amber-200 dark:border-amber-800/40 rounded-3xl p-5 ${
        isCarousel ? 'min-h-[180px] flex flex-col justify-center' : 'pr-9'
      }`}
    >
      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`${isCarousel ? 'text-base' : 'text-sm'} text-gray-800 dark:text-gray-200 leading-snug`}>
        {text}
      </p>
      {!isCarousel && (
        <button
          onClick={handleDismiss}
          aria-label={lang === 'es' ? 'Cerrar consejo' : 'Dismiss tip'}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-amber-700/60 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400/60 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 transition-colors text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  )

  const wrapperClass = isCarousel ? 'block active:scale-[0.98] transition-transform' : 'block mt-3 active:scale-[0.98] transition-transform'

  if (tip.href) {
    return (
      <Link
        href={tip.href}
        onClick={() => trackEvent('daily_tip_tapped', { tip_id: tip.id, href: tip.href || null })}
        className={wrapperClass}
      >
        {body}
      </Link>
    )
  }

  return <div className={isCarousel ? '' : 'mt-3'}>{body}</div>
}
