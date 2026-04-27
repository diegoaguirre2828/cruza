'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// Defer-mount wrapper for the 10 non-critical global overlays that
// previously eagerly loaded in app/layout.tsx. Each is a Client
// Component that calls window / localStorage / navigator on mount
// but contributes nothing to first paint. Bundling them into the
// initial HTML + JS stacked ~18 client components before the user
// saw a number.
//
// Strategy: dynamic import with ssr:false (Client Component so the
// flag is allowed) + gated render that waits one animation frame
// after hydration so the homepage hero paints first.

const ReactionsWelcomeToast = dynamic(
  () => import('./ReactionsWelcomeToast').then(m => m.ReactionsWelcomeToast),
  { ssr: false }
)
const FirstVisitInstallSheet = dynamic(
  () => import('./FirstVisitInstallSheet').then(m => m.FirstVisitInstallSheet),
  { ssr: false }
)
const PWASetup = dynamic(
  () => import('./PWASetup').then(m => m.PWASetup),
  { ssr: false }
)
const GlobalInstallPromptCapture = dynamic(
  () => import('./GlobalInstallPromptCapture').then(m => m.GlobalInstallPromptCapture),
  { ssr: false }
)
const ClaimProInPwa = dynamic(
  () => import('./ClaimProInPwa').then(m => m.ClaimProInPwa),
  { ssr: false }
)
const PwaGrantCelebration = dynamic(
  () => import('./PwaGrantCelebration').then(m => m.PwaGrantCelebration),
  { ssr: false }
)
const SessionPingMount = dynamic(
  () => import('./SessionPingMount').then(m => m.SessionPingMount),
  { ssr: false }
)
const TwaPromoBanner = dynamic(
  () => import('./TwaPromoBanner').then(m => m.TwaPromoBanner),
  { ssr: false }
)
const GlobalPushPromptOnAlertCreated = dynamic(
  () => import('./GlobalPushPromptOnAlertCreated').then(m => m.GlobalPushPromptOnAlertCreated),
  { ssr: false }
)
const MetaPixel = dynamic(
  () => import('./MetaPixel').then(m => m.MetaPixel),
  { ssr: false }
)
const PostSignupInstallNudge = dynamic(
  () => import('./PostSignupInstallNudge').then(m => m.PostSignupInstallNudge),
  { ssr: false }
)

export function LazyGlobalOverlays() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Wait for first idle moment so the homepage hero + port list
    // paint before we mount ten more client components. Falls back
    // to 500ms setTimeout if requestIdleCallback isn't available
    // (Safari).
    const schedule = (cb: () => void) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(cb, { timeout: 1200 })
      } else {
        setTimeout(cb, 500)
      }
    }
    schedule(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <>
      <ReactionsWelcomeToast />
      <FirstVisitInstallSheet />
      <PWASetup />
      <GlobalInstallPromptCapture />
      <ClaimProInPwa />
      <PwaGrantCelebration />
      <SessionPingMount />
      <TwaPromoBanner />
      <GlobalPushPromptOnAlertCreated />
      <MetaPixel />
      <PostSignupInstallNudge />
    </>
  )
}
