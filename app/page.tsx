import { HomeClient } from '@/components/HomeClient'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import type { PortWaitTime } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server component shell. Fetches port data on the server so the hero paints
// with real numbers on first paint — no client round-trip to /api/ports, no
// blank loading state during the first 1-3 seconds. This is the single biggest
// bounce-rate lever on a Facebook-sourced visitor: first 3 seconds decide
// whether they stay or back out.
//
// The full port list + live reports still hydrate client-side (they need
// auth/tier + reports data the hero doesn't), but the above-the-fold hero
// is instant.
export default async function Page() {
  let initialPorts: PortWaitTime[] | null = null
  try {
    initialPorts = await fetchRgvWaitTimes()
  } catch {
    // Fall through — HomeClient will refetch from /api/ports client-side.
    // Not throwing here means a CBP outage still serves the page shell.
  }
  return <HomeClient initialPorts={initialPorts} />
}
