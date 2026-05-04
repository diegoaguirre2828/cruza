'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

// Phase 2 bottom nav. Five fixed tabs: Home / All bridges / Pro (cameras)
// / Mi panel (dashboard) / Más.
//
// 2026-05-04 update — Diego: "replace the guardians tab with the
// dashboard that is found in more. guardian tab on the bottom should
// just be a pill in the collapsible thing on top of the main page."
// Reasoning: /dashboard surfaces the user's daily-use state (alerts,
// favorites, recent reports, install nudge) and deserves a permanent
// bottom-nav slot. The Guardian/leaderboard tab was lower-frequency
// and is already represented by the GuardianProgressCard pill in the
// collapsible header on Home (links to /leaderboard).

// Only hidden on tight flows where the user needs to commit to a
// step — login, signup, welcome, driver check-in, admin.
const HIDDEN_PATHS = [
  '/login',
  '/signup',
  '/welcome',
  '/reset-password',
  '/driver',
  '/checkin',
  '/admin',
  '/ios-install',
  // '/onboarding' removed 2026-05-02 — page does not exist; was dead config.
]

export function BottomNav() {
  const pathname = usePathname()
  const { lang } = useLang()
  const es = lang === 'es'

  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const tabs = [
    {
      href: '/',
      label: es ? 'Inicio' : 'Home',
      active: isActive('/', true),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
        </svg>
      ),
    },
    {
      href: '/todos',
      label: es ? 'Todos' : 'All bridges',
      active: isActive('/todos'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    },
    {
      href: '/camaras',
      label: es ? 'Pro' : 'Pro',
      active: isActive('/camaras') || isActive('/datos'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      proBadge: true,
    },
    {
      href: '/dashboard',
      label: es ? 'Mi panel' : 'Dashboard',
      active: isActive('/dashboard'),
      icon: (active: boolean) => (
        // Grid / dashboard icon — distinct from the home/house glyph.
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" strokeLinejoin="round" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" strokeLinejoin="round" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" strokeLinejoin="round" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/mas',
      label: es ? 'Más' : 'More',
      // /dashboard removed from active-match list — it has its own tab now.
      active: isActive('/mas') || isActive('/account') || isActive('/negocios'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={true}
            // Empty onClick + cursor-pointer fights the iOS Safari
            // "first tap dead" quirk in PWA standalone mode where
            // <Link> clicks sometimes need a primed click target
            // before they register.
            onClick={() => {}}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 cursor-pointer transition-transform duration-100 active:scale-[0.92] relative touch-manipulation ${
              tab.active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon(tab.active)}
            <span className={`text-[10px] leading-none ${tab.active ? 'font-black' : 'font-semibold'}`}>
              {tab.label}
            </span>
            {tab.proBadge && (
              <span className="absolute top-1 right-1/2 translate-x-5 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full leading-none">
                PRO
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}
