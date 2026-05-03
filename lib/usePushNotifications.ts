'use client'

import { useState, useEffect } from 'react'

export function usePushNotifications() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // On iOS, Web Push only works when the site is installed as a PWA
    // via "Add to Home Screen" — prompting inside a Safari tab silently
    // fails and burns the user's ability to opt in later. Gate support
    // on standalone display-mode so the in-app alert prompt + any other
    // caller of this hook skip the prompt until the user installs.
    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua)
    if (isIos) {
      type IosNav = Navigator & { standalone?: boolean }
      const standalone =
        (navigator as IosNav).standalone === true ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
      if (!standalone) return
    }

    setSupported(true)
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub)
        // Re-sync the existing browser subscription to the server on
        // every mount. Without this, a stale browser subscription
        // (cached from a prior install, pre-VAPID-rotation, or after a
        // server-side row was 410-cleaned) silently desyncs: the
        // browser thinks it's subscribed and hides the "Enable" prompt,
        // but the server has no row so push never delivers. The
        // /api/push/subscribe endpoint is upsert-by-endpoint (see v40
        // migration) so this is idempotent — duplicate POSTs are
        // no-ops.
        if (sub) {
          fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
            credentials: 'include',
          }).catch(() => { /* silent */ })
        }
      })
    })
  }, [])

  async function subscribe() {
    // 30s in-flight lock — guards against multiple grant prompts firing
    // concurrently when the user taps the bell while FirstAlertNudge or
    // PushPermissionPrompt is already mid-flight. iOS only ever shows
    // one native prompt, but the JS layer was triggering 2-3 sheets
    // back-to-back. Diego 2026-05-02 audit HIGH #4.
    try {
      const flag = typeof window !== 'undefined' ? localStorage.getItem('cruzar_push_grant_in_flight') : null
      if (flag) {
        const ts = parseInt(flag, 10)
        if (Number.isFinite(ts) && Date.now() - ts < 30_000) return
      }
      if (typeof window !== 'undefined') localStorage.setItem('cruzar_push_grant_in_flight', String(Date.now()))
    } catch { /* ignore */ }

    setLoading(true)
    try {
      // Ensure permission is granted (will prompt the user if default)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') {
          try { await fetch('/api/events/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'push_permission_denied', props: { result } }), keepalive: true }) } catch { /* ignore */ }
          setLoading(false)
          return
        }
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        try { await fetch('/api/events/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'push_permission_denied', props: { result: 'denied_pre_existing' } }), keepalive: true }) } catch { /* ignore */ }
        setLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        // Make sure the server has this endpoint recorded (it may have
        // been created before the user was logged in)
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existing),
        }).catch(() => {})
        setSubscribed(true); setLoading(false); return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('VAPID key not configured')

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })

      setSubscribed(true)
    } catch (err) {
      console.error('Push subscribe error:', err)
    }
    try { if (typeof window !== 'undefined') localStorage.removeItem('cruzar_push_grant_in_flight') } catch { /* ignore */ }
    setLoading(false)
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/subscribe', { method: 'DELETE' })
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    }
    setLoading(false)
  }

  return { supported, subscribed, loading, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
