// Server component entry — reads the User-Agent server-side via
// isIOSAppServer() so the SSR HTML is already iOS-aware before it
// reaches Apple Review's webview. No useEffect, no flash, no race.
//
// Without this split: 2026-05-03 audit confirmed the previous client-only
// page rendered all 7 paid-tier Stripe buttons in the SSR HTML on iOS UA
// before hydration replaced them with IOSSubscribeButton + "Fleet
// accounts only" placeholder. Hydration window ~50ms — small but
// non-zero risk for Apple's automated review tools or fast-tap reviewer.
// Server-side detection closes the gap entirely.

import { isIOSAppServer } from '@/lib/platform'
import { PricingClient } from './PricingClient'

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const isIosApp = await isIOSAppServer()
  return <PricingClient isIosApp={isIosApp} />
}
