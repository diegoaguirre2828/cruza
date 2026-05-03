'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/trackEvent'

const FIRST_OPEN_KEY = 'cruzar_first_open_v1'

// Fires `app_first_open` exactly once per device. Captures geo (best-
// effort, no prompt — uses cached coords if user has already granted),
// referrer, install source (PWA / browser / iOS standalone), and the
// initial URL path. Lets us draw a first-touch acquisition map without
// asking for permissions.

export function FirstOpenTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(FIRST_OPEN_KEY)) return
      localStorage.setItem(FIRST_OPEN_KEY, String(Date.now()))
    } catch { return }

    const ua = navigator.userAgent || ''
    type IosNav = Navigator & { standalone?: boolean }
    const isIosStandalone = (navigator as IosNav).standalone === true
    const isStandalone = isIosStandalone || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    const installSource = isStandalone ? (isIosStandalone ? 'ios_pwa' : 'pwa') : 'browser'
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref') || params.get('utm_source') || null
    const path = window.location.pathname

    function fire(geo: { lat: number; lng: number; accuracy: number } | null) {
      trackEvent('app_first_open', {
        path,
        referrer: document.referrer || null,
        ref,
        install_source: installSource,
        ua: ua.slice(0, 200),
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        accuracy_m: geo?.accuracy ?? null,
      })
    }

    // Best-effort geo — only succeeds if user has previously granted
    // geolocation. Never prompts here. 4s ceiling so we don't delay.
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(p => {
          if (p.state === 'granted' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => fire({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
              () => fire(null),
              { maximumAge: 5 * 60 * 1000, timeout: 4000, enableHighAccuracy: false },
            )
          } else {
            fire(null)
          }
        })
        .catch(() => fire(null))
    } else {
      fire(null)
    }
  }, [])

  return null
}
