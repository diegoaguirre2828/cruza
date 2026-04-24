'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { initRevenueCat } from '@/lib/revenueCat'
import { isIOSAppClient } from '@/lib/platform'

// Mount-once initializer for RevenueCat. No-op on web / Android /
// non-app iOS Safari; on Capacitor iOS it configures the SDK with
// the user's Supabase ID so purchases can be attributed across
// devices.

export function RevenueCatInit() {
  const { user } = useAuth()

  useEffect(() => {
    if (!isIOSAppClient()) return
    initRevenueCat(user?.id).catch(err => {
      console.warn('[RevenueCat] init failed', err)
    })
  }, [user?.id])

  return null
}
