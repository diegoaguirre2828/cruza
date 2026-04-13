'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { createClient } from './auth'

export type Tier = 'guest' | 'free' | 'pro' | 'business'

export function useTier(): { tier: Tier; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  const [tier, setTier] = useState<Tier>('guest')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setTier('guest')
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase
      .from('profiles')
      .select('tier, pro_via_pwa_until')
      .eq('id', user.id)
      .single()
      .then(async ({ data }) => {
        const dbTier = (data?.tier as Tier) || 'free'
        const pwaUntil = data?.pro_via_pwa_until ? new Date(data.pro_via_pwa_until).getTime() : 0
        const pwaExpired = pwaUntil > 0 && pwaUntil < Date.now()

        // If the PWA-granted Pro has expired but the DB still says Pro, the
        // row is stale. Call sync-tier — it's the idempotent source of truth
        // that reconciles with Stripe and keeps the user on Pro if they
        // actually have a paid sub, else downgrades to free.
        if (dbTier === 'pro' && pwaExpired) {
          try {
            const res = await fetch('/api/profile/sync-tier', { method: 'POST' })
            if (res.ok) {
              const { tier: syncedTier } = await res.json()
              setTier((syncedTier as Tier) || 'free')
              setLoading(false)
              return
            }
          } catch { /* fall through to DB tier */ }
        }

        setTier(dbTier)
        setLoading(false)
      })
  }, [user, authLoading])

  return { tier, loading }
}

export function canAccess(tier: Tier, feature: string): boolean {
  const access: Record<string, Tier[]> = {
    save_crossings:   ['free', 'pro', 'business'],
    driver_reports:   ['free', 'pro', 'business'],
    alerts:           ['pro', 'business'],
    ai_predictions:   ['pro', 'business'],
    route_optimizer:  ['pro', 'business'],
    fleet_panel:      ['business'],
    data_export:      ['business'],
    api_access:       ['business'],
    no_ads:           ['free', 'pro', 'business'],
  }
  return access[feature]?.includes(tier) ?? false
}
