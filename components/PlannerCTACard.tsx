'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Surfaces /planner from the home. The planner does day-of-week +
// hour-of-day predictions ("fastest bridge if you leave at 6pm
// Tuesday, or shift to 5pm and save 18min") but had zero inbound
// links from any primary surface — users had to hunt for it via
// /features or /mas. This card is a one-tap entry point.
//
// Public — works for guests too. No tier gate.

export function PlannerCTACard() {
  const { lang } = useLang()
  const es = lang === 'es'
  return (
    <Link
      href="/planner"
      onClick={() => trackEvent('planner_cta_tapped', { source: 'home_mio' })}
      className="mt-3 flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 active:scale-[0.99] transition-transform shadow-sm"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <Clock className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
          {es ? '¿A qué hora vas a cruzar?' : 'When are you crossing?'}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
          {es
            ? 'Te decimos qué puente estará más rápido a esa hora'
            : "We'll tell you which bridge will be fastest at that time"}
        </p>
      </div>
      <span className="flex-shrink-0 text-gray-400 dark:text-gray-500 text-base">→</span>
    </Link>
  )
}
