'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

// Floating action button for Cruz (AI chat). Rendered globally in
// app/layout.tsx so it floats on every tab — Home, Mapa, Datos,
// Guardián, Más. Visible on BOTH mobile and desktop now — used to
// be md:hidden which meant desktop users never saw it.
//
// Purpose: feature discovery. Cruzar has a lot of functionality
// buried under /mas and auth gates (Pro alerts, historical
// patterns, route optimizer, cameras, lane reports, etc.) that
// new users don't find on their own. A persistent, always-visible
// AI help button lets anyone ask "¿qué tiene esta app?" and get
// pointed at the right tab. Click → /chat where the Claude-backed
// assistant handles open-ended questions.
//
// The icon inside the FAB is now the real Cruzar bridge logo
// (public/logo-icon.svg), replacing the old styled "C" avatar
// that Diego flagged as branding drift.

// Hide on entry flows + on /chat itself (where it'd be redundant).
const HIDDEN_PATHS = ['/login', '/signup', '/welcome', '/chat', '/driver', '/checkin', '/admin', '/business', '/promoter']

export function CruzFab() {
  const { lang } = useLang()
  const pathname = usePathname()
  const es = lang === 'es'

  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  return (
    <Link
      href="/chat"
      aria-label={es ? 'Preguntarle a Cruz' : 'Ask Cruz'}
      className="fixed z-40 right-4 group flex items-center gap-2 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 text-white rounded-full pl-1.5 pr-4 py-1.5 shadow-2xl active:scale-95 transition-all hover:pr-5"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      {/* Pulsing ring to draw attention on first few visits without
          being obnoxious. Pure CSS, no JS. */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-pink-500 opacity-40 animate-ping" style={{ animationDuration: '3s' }} aria-hidden="true" />
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
    </Link>
  )
}
