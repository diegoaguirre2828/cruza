'use client'

import { useEffect } from 'react'
import { isIOSAppClient } from '@/lib/platform'
import { initSocialLogin } from '@/lib/socialLogin'

// Mirrors RevenueCatInit — fires once after first paint to register the
// Capacitor social-login plugin. Web/PWA users skip the init since their
// auth flows go through Supabase OAuth redirect, not the plugin.
export function SocialLoginInit() {
  useEffect(() => {
    if (!isIOSAppClient()) return
    initSocialLogin().catch((err) => {
      console.warn('[SocialLogin] init failed', err)
    })
  }, [])
  return null
}
