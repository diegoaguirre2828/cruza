'use client'

import { useEffect, useState } from 'react'
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
  // Expanded = full "Ask Cruz" pill. Collapses to a 44px icon-only
  // bubble after the user has had a moment to notice it OR scrolls.
  // Reason: Diego was seeing content (exchange rate sheet, insights
  // dropdown list, chat input) getting covered by the wide pill on
  // every tab. Icon-only stays discoverable without obscuring.
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    // Reset to expanded whenever the user changes route so they see
    // the full label once per page visit.
    setExpanded(true)
    const collapseTimer = setTimeout(() => setExpanded(false), 4500)
    const collapseOnScroll = () => setExpanded(false)
    window.addEventListener('scroll', collapseOnScroll, { passive: true })
    return () => {
      clearTimeout(collapseTimer)
      window.removeEventListener('scroll', collapseOnScroll)
    }
  }, [pathname])

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
        onMouseEnter={() => setExpanded(true)}
        aria-label={es ? 'Preguntarle a Cruz' : 'Ask Cruz'}
        disabled={open}
        className={`fixed z-40 right-4 group flex items-center bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 text-white rounded-full shadow-2xl active:scale-90 transition-all duration-300 ease-out disabled:opacity-80 disabled:pointer-events-none ${
          expanded ? 'gap-2 pl-1.5 pr-4 py-1.5' : 'gap-0 p-1'
        }`}
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Pulsing ring — only while expanded, otherwise it's just a
            quiet icon and the ping becomes visual noise. */}
        {expanded && (
          <span
            className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-pink-500 opacity-40 animate-ping"
            style={{ animationDuration: '3s' }}
            aria-hidden="true"
          />
        )}
        <span className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden">
          <img
            src="/logo-icon.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-md"
          />
        </span>
        <span
          className={`relative text-xs font-black leading-none whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ${
            expanded ? 'max-w-[220px] opacity-100' : 'max-w-0 opacity-0'
          }`}
        >
          {es ? '¿Dudas? Pregúntale a Cruz' : 'Got questions? Ask Cruz'}
        </span>
      </button>

      <CruzHelperSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
