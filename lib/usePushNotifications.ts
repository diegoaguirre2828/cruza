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
      reg.pushManager.getSubscription().then(async sub => {
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
          // VAPID-mismatch detection. 2026-05-03 root cause: 4 dead
          // push_subscriptions rows all returned 403/400 VapidPkHashMismatch
          // because VAPID was rotated (likely 2026-04-23 security rotation)
          // but cached browser subscriptions still hold the OLD public key.
          // Browser thinks it's subscribed; both FCM and Apple reject our
          // server's payloads silently. Detect by comparing the cached
          // sub's applicationServerKey to the current env public key —
          // mismatch = force unsubscribe, clear server row, set state to
          // un-subscribed so the user can re-grant cleanly.
          const expectedVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (expectedVapid && sub.options?.applicationServerKey) {
            const actualVapid = arrayBufferToBase64Url(sub.options.applicationServerKey)
            if (actualVapid !== expectedVapid) {
              trackPushEvent('push_vapid_mismatch', { actual_prefix: actualVapid.slice(0, 16), expected_prefix: expectedVapid.slice(0, 16) })
              await sub.unsubscribe().catch(() => {})
              try {
                await fetch('/api/push/subscribe', { method: 'DELETE', credentials: 'include' })
              } catch { /* ignore */ }
              setSubscribed(false)
              return
            }
          }
          const payload = serializeSubscription(sub)
          if (payload && payload.keys.p256dh && payload.keys.auth) {
            fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'include',
            }).then(async res => {
              if (!res.ok) {
                const status = res.status
                let detail = ''
                try { detail = JSON.stringify(await res.json()) } catch { /* ignore */ }
                trackPushEvent('push_resync_failed', { status, detail: detail.slice(0, 240) })
              } else {
                trackPushEvent('push_resync_ok', {})
              }
            }).catch(err => {
              trackPushEvent('push_resync_threw', { detail: String(err?.message ?? err).slice(0, 240) })
            })
          } else {
            trackPushEvent('push_resync_missing_keys', { has_p256dh: !!payload?.keys.p256dh, has_auth: !!payload?.keys.auth })
            sub.unsubscribe().catch(() => {})
            setSubscribed(false)
          }
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
        // Same VAPID-mismatch check as mount path. If the cached sub's
        // applicationServerKey doesn't match current env, unsubscribe + fall
        // through to fresh subscribe below. Skipping this check would re-POST
        // a dead sub to the server (which would 200 since the keys are
        // present) but the next push send would 403/400 VapidPkHashMismatch.
        const expectedVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        let vapidMatches = true
        if (expectedVapid && existing.options?.applicationServerKey) {
          const actualVapid = arrayBufferToBase64Url(existing.options.applicationServerKey)
          if (actualVapid !== expectedVapid) {
            vapidMatches = false
            trackPushEvent('push_vapid_mismatch_on_grant', { actual_prefix: actualVapid.slice(0, 16) })
          }
        }
        if (vapidMatches) {
          const payload = serializeSubscription(existing)
          if (payload && payload.keys.p256dh && payload.keys.auth) {
            // Server-side row may have been 410-cleaned. Re-POST to be safe.
            const res = await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (res.ok) {
              setSubscribed(true); setLoading(false); return
            }
            // 4xx/5xx = something's off. Tear down + regenerate below.
          }
        }
        await existing.unsubscribe().catch(() => {})
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('VAPID key not configured')

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      })

      const payload = serializeSubscription(sub)
      if (!payload || !payload.keys.p256dh || !payload.keys.auth) {
        throw new Error('Subscription missing required keys after fresh subscribe')
      }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(`subscribe POST failed: ${body.error ?? res.status}`)
      }

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

// Serialize a PushSubscription so the keys are guaranteed-present in the
// JSON payload. Diego 2026-05-03 root cause: 16 days of silent push
// signup failures because some Safari/iOS PWA paths returned a sub
// where JSON.stringify(sub) emitted `keys` as null/empty. Pulling the
// keys explicitly via getKey() and url-base64-encoding them ourselves
// guarantees the server gets non-null p256dh + auth.
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function trackPushEvent(event_name: string, props: Record<string, unknown>): void {
  try {
    fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name, props }),
      keepalive: true,
    }).catch(() => { /* telemetry must not throw */ })
  } catch { /* ignore */ }
}

function serializeSubscription(sub: PushSubscription): { endpoint: string; keys: { p256dh: string | null; auth: string | null } } | null {
  if (!sub?.endpoint) return null
  let p256dh: string | null = null
  let auth: string | null = null
  try {
    const p = sub.getKey?.('p256dh')
    if (p) p256dh = arrayBufferToBase64Url(p)
    const a = sub.getKey?.('auth')
    if (a) auth = arrayBufferToBase64Url(a)
  } catch { /* fall through */ }
  if (!p256dh || !auth) {
    // Last resort: try the toJSON path. Some browsers populate keys here
    // even when getKey() returns null.
    try {
      const json = sub.toJSON?.() as { keys?: { p256dh?: string; auth?: string } } | undefined
      if (!p256dh && json?.keys?.p256dh) p256dh = json.keys.p256dh
      if (!auth && json?.keys?.auth) auth = json.keys.auth
    } catch { /* ignore */ }
  }
  return { endpoint: sub.endpoint, keys: { p256dh, auth } }
}
