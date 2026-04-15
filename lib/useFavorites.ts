'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'

// Favorites hook — wraps /api/saved with a local in-memory Set so any
// number of PortCards can read "is this starred?" synchronously after
// the first fetch. Used by PortCard (star toggle), PortList (Favorites
// section at the top of the home list), and /favorites (dedicated
// page). Guests get an empty set + a no-op toggle; the star button
// handles the signup redirect itself.

interface SavedRow {
  port_id: string
  label?: string | null
}

export function useFavorites() {
  const { user, loading: authLoading } = useAuth()
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setFavorites(new Set())
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/saved', { cache: 'no-store' })
      if (!res.ok) {
        setFavorites(new Set())
        return
      }
      const json = await res.json()
      const ids = new Set<string>((json.saved as SavedRow[] | undefined)?.map((r) => r.port_id) ?? [])
      setFavorites(ids)
    } catch {
      setFavorites(new Set())
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    refresh()
  }, [authLoading, refresh])

  const isFavorite = useCallback((portId: string) => favorites.has(portId), [favorites])

  const toggleFavorite = useCallback(
    async (portId: string, label?: string) => {
      if (!user) return { ok: false, reason: 'guest' as const }
      const currentlyFavorite = favorites.has(portId)
      // Optimistic update so the star flips instantly; rolled back on failure.
      setFavorites((prev) => {
        const next = new Set(prev)
        if (currentlyFavorite) next.delete(portId)
        else next.add(portId)
        return next
      })
      try {
        const res = currentlyFavorite
          ? await fetch(`/api/saved?portId=${encodeURIComponent(portId)}`, { method: 'DELETE' })
          : await fetch('/api/saved', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ portId, label }),
            })
        if (!res.ok) throw new Error('save failed')
        return { ok: true as const }
      } catch {
        setFavorites((prev) => {
          const next = new Set(prev)
          if (currentlyFavorite) next.add(portId)
          else next.delete(portId)
          return next
        })
        return { ok: false, reason: 'network' as const }
      }
    },
    [favorites, user]
  )

  return { favorites, isFavorite, toggleFavorite, loading, signedIn: !!user }
}
