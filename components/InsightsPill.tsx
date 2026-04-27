'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Pro insights pill for the home header. /datos has hourly patterns,
// best-time-to-cross by day-of-week, and weather-aware predictions —
// all unlocked for Pro/Business but most users never find them. The
// existing PriorityNudge surfaces /datos but only when armed; a
// persistent pill in the header makes it always discoverable for
// users who already have the unlock.
//
// Renders only when the parent decides to render it (Pro/Business
// tier check lives in HomeClient.tsx).

export function InsightsPill() {
  const { lang } = useLang()
  const es = lang === 'es'
  return (
    <Link
      href="/datos"
      onClick={() => trackEvent('insights_pill_tapped', { source: 'home_header' })}
      className="cruzar-pill inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full px-2.5 py-1.5 transition-colors"
    >
      <span className="text-base leading-none">📊</span>
      <span className="text-[11px] font-black whitespace-nowrap">
        {es ? 'Tus insights' : 'Your insights'}
      </span>
    </Link>
  )
}
