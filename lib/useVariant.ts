'use client'

import { useEffect, useState } from 'react'

// Tiny self-rolled A/B variant assigner. No external service — just
// localStorage-backed sticky bucketing per experiment key. Variant is
// fixed for the user across sessions until they clear storage; this
// keeps measurement honest (a user who saw variant A on day 1 keeps
// seeing it on day 7, no flip-flopping).
//
// Usage:
//   const variant = useVariant('ribbon_dismissible_v1', ['control', 'sticky'])
//   if (variant === 'sticky') ...
//
// On first call we hash the user's existing session id (or roll a
// fresh per-experiment id) into a bucket. The bucket is written to
// localStorage as `cruzar_variant_<key>` so subsequent loads return
// the same value without re-rolling.
//
// Returns null on the SSR pass and on the first client render before
// useEffect runs — caller should treat null as "show control" so the
// page doesn't flicker between variants.

const KEY_PREFIX = 'cruzar_variant_'

export function useVariant<T extends string>(
  experimentKey: string,
  variants: readonly T[]
): T | null {
  const [variant, setVariant] = useState<T | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `${KEY_PREFIX}${experimentKey}`
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached && variants.includes(cached as T)) {
        setVariant(cached as T)
        return
      }
    } catch { /* private browsing, etc. */ }

    // Roll fresh — even split across the variants array.
    const idx = Math.floor(Math.random() * variants.length)
    const picked = variants[idx]
    setVariant(picked)
    try { localStorage.setItem(storageKey, picked) } catch { /* ignore */ }
  }, [experimentKey, variants])

  return variant
}
