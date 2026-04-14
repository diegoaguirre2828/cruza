'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { CruzHelperSheet } from './CruzHelperSheet'
import { trackEvent } from '@/lib/trackEvent'

// Floating AI help button — the Cruzar feature-discovery surface.
// Rendered globally in app/layout.tsx so it floats on every tab
// except the auth / admin / checkin flows where it'd be redundant.
// Visible on BOTH mobile and desktop (was md:hidden before).
//
// Tap behavior: opens CruzHelperSheet, a bottom-sheet (mobile)
// or centered modal (desktop) with:
//   - "Take a quick tour" → fires the OnboardingTour event
//   - 5 quick action tiles linking to alerts / map / cameras /
//     route optimizer / leaderboard (feature discovery)
//   - A prominent "Ask Cruz anything" CTA → /chat
//
// Previously this was a simple Link to /chat. The sheet upgrade
// was driven by Diego's observation that "users may be unaware
// of how much we offer unless you go to the more tab" — making
// the FAB feel like an AI helper (not just a chat link) turns it
// into an always-visible index of what the app can do.

// Hide on entry flows + on /chat itself (where it'd be redundant).
const HIDDEN_PATHS = ['/login', '/signup', '/welcome', '/chat', '/driver', '/checkin', '/admin', '/business', '/promoter']

export function CruzFab() {
  const { lang } = useLang()
  const pathname = usePathname()
  const es = lang === 'es'
  const [open, setOpen] = useState(false)

  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  function handleOpen() {
    setOpen(true)
    trackEvent('cruz_fab_opened', { path: pathname })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={es ? 'Preguntarle a Cruz' : 'Ask Cruz'}
        className="fixed z-40 right-4 group flex items-center gap-2 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 text-white rounded-full pl-1.5 pr-4 py-1.5 shadow-2xl active:scale-95 transition-all hover:pr-5"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Pulsing ring — 3 second cycle so it's gentle, not obnoxious */}
        <span
          className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-pink-500 opacity-40 animate-ping"
          style={{ animationDuration: '3s' }}
          aria-hidden="true"
        />
        <span className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden">
          <img
            src="/logo-icon.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-md"
          />
        </span>
        <span className="relative text-xs font-black leading-none whitespace-nowrap">
          {es ? '¿Dudas? Pregúntale a Cruz' : 'Got questions? Ask Cruz'}
        </span>
      </button>

      <CruzHelperSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
