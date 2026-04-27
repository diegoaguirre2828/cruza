'use client'

import { useEffect, useState } from 'react'

// Tracks how many founding-member promo slots are still open. Used by
// every install surface to keep marketing copy honest:
//   - Slots remaining → headline = "Pro de por vida · Primeros 1,000"
//   - Slots full      → headline = "3 meses Pro" (the post-cap fallback)
//
// Reads from /api/stats/community which is edge-cached for 60s. Safe
// to call from many components — they share the cache. Falls back to
// `null` (= "loading / unknown") so callers can render the lifetime
// copy optimistically while we resolve.

interface FoundingSlots {
  remaining: number | null
  full: boolean
  loading: boolean
}

let cached: { remaining: number; at: number } | null = null
const TTL_MS = 60 * 1000

export function useFoundingSlots(): FoundingSlots {
  const [remaining, setRemaining] = useState<number | null>(() => {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.remaining
    return null
  })
  const [loading, setLoading] = useState(remaining === null)

  useEffect(() => {
    if (cached && Date.now() - cached.at < TTL_MS) {
      setRemaining(cached.remaining)
      setLoading(false)
      return
    }
    let cancelled = false
    fetch('/api/stats/community')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const n = typeof d?.promoRemaining === 'number' ? d.promoRemaining : null
        if (n !== null) cached = { remaining: n, at: Date.now() }
        setRemaining(n)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { remaining, full: remaining !== null && remaining <= 0, loading }
}
