'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

// Thin persistent strip at the very top of the home page for guests.
// Unmissable — sticks even after they've dismissed the first-launch
// welcome overlay, so anyone who picked "just peek" still has an
// always-visible entry point to signup. Diego 2026-04-15: "there could
// be a whole group of users who just have the pwa and not logged in,
// or thought the app was broken."
//
// Intentionally terse. Full pitch lives in the GuestSignupBanner
// further down the page — this is a reminder, not a sales pitch.
export function GuestStickyStrip() {
  const { user, loading } = useAuth()
  const { lang } = useLang()
  if (loading || user) return null
  const es = lang === 'es'
  return (
    <Link
      href="/signup?next=/"
      className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold py-2 px-4 text-center active:opacity-90"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
        {es
          ? 'Estás viendo Cruzar como invitado · crea tu cuenta gratis →'
          : "You're browsing as a guest · create your free account →"}
      </span>
    </Link>
  )
}
