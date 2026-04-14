'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/trackEvent'
import { createClient } from '@/lib/auth'

// Global PWA plumbing. Renders no UI — the install-prompt UI now lives
// in InstallPill (home header), FirstVisitInstallSheet (global), the
// ClaimProInPwa sticky (inside the installed PWA), and /mas install card.
//
// This file's job is the invisible plumbing:
//   1. Register the service worker
//   2. Listen for the appinstalled browser event and claim the 3-month
//      Pro grant for the signed-in user
//   3. On every page load, if the app is running as a standalone PWA
//      and the grant hasn't been claimed yet, claim it
//   4. Listen to Supabase auth state transitions — when a user signs IN
//      inside the PWA (the biggest failure mode on iOS, where Safari's
//      session cookie doesn't transfer to the PWA context), retry the
//      claim immediately. This is Fix B from the 2026-04-14 funnel audit.
//
// Bugs this version solves:
//   - iOS partitions PWA storage from Safari storage, so the user lands
//     in the installed PWA signed-OUT. The old code's claim attempt 401'd
//     silently and the localStorage flag was never written, so nothing
//     ever retried. Now we only write the claim flag on a SUCCESSFUL
//     claim, and we re-attempt on every auth state transition.
//   - The cruzar:pwa-grant-claimed custom event had zero listeners in
//     the codebase. Now <PwaGrantCelebration /> (mounted in the layout)
//     picks it up and shows a full-screen celebration modal.

const PWA_GRANT_CLAIMED_KEY = 'cruzar_pwa_grant_claimed'

async function tryClaimGrant() {
  try {
    const alreadyClaimed = localStorage.getItem(PWA_GRANT_CLAIMED_KEY)
    if (alreadyClaimed) return
  } catch { /* ignore */ }

  try {
    const res = await fetch('/api/user/claim-pwa-pro', { method: 'POST' })
    // 401 = user isn't authenticated in this browser context. DON'T set
    // the dedupe flag — the next auth state transition should retry.
    if (res.status === 401) return
    if (!res.ok) return
    const data = await res.json()
    if (data?.ok) {
      try { localStorage.setItem(PWA_GRANT_CLAIMED_KEY, String(Date.now())) } catch { /* ignore */ }
      trackEvent('pwa_grant_claimed', {
        granted: data.granted || false,
        days: data.days || null,
      })
      // Fire a window event so <PwaGrantCelebration /> shows the modal.
      if (data.granted && data.days) {
        window.dispatchEvent(
          new CustomEvent('cruzar:pwa-grant-claimed', { detail: { days: data.days } }),
        )
      }
    }
  } catch { /* silent — endpoint requires auth, fine to fail for guests */ }
}

export function PWASetup() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Service worker registration — unchanged. The SW handles push
    // notifications, offline caching, and SWR for /api/ports and
    // /api/reports/recent.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    // If we're running as an installed PWA right now, try to claim
    // the grant immediately. Idempotent server-side, and localStorage
    // dedupe prevents repeated fetches on successful claims.
    if (isStandalone) {
      tryClaimGrant()
    }

    // Listen for the actual install event so users installing NOW get
    // the grant without needing to reload. Note: this event does NOT
    // fire on iOS Safari "Add to Home Screen" — Apple doesn't emit it.
    // That's fine because the next time the user opens the installed
    // PWA, display-mode:standalone will match and we'll fire the claim
    // via the path above.
    const onInstalled = () => tryClaimGrant()
    window.addEventListener('appinstalled', onInstalled)

    // Fix B — retry on auth state transitions. This is THE critical
    // path for iOS users: they install the PWA, open it, and land
    // signed-out because iOS partitions storage from Safari. When they
    // sign in (or sign up again), Supabase fires onAuthStateChange with
    // SIGNED_IN and we immediately retry the claim. Without this, the
    // 92 missing claims from the 2026-04-14 funnel audit stay lost.
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (isStandalone) {
          tryClaimGrant()
        }
      }
    })

    return () => {
      window.removeEventListener('appinstalled', onInstalled)
      subscription.unsubscribe()
    }
  }, [])

  return null
}
