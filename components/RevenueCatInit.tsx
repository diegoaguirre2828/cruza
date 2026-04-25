'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { initRevenueCat } from '@/lib/revenueCat'
import { isIOSAppClient } from '@/lib/platform'

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
