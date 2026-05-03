'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/auth'
import { useLang } from '@/lib/LangContext'
import { isIOSAppClient } from '@/lib/platform'

// Sign in with Apple — pure Supabase OAuth, web only.
//
// Rebuilt from scratch 2026-05-03 evening after multiple half-fixes.
// Prior versions carried a Capacitor native SIWA path (@capgo/capacitor-
// social-login) that we never use anymore: the iOS app hides the button
// entirely (Apple Review prep — see proxy.ts sister-site split + the
// isIOSAppClient self-hide below). Removing that dead path stripped 60
// lines of plugin glue, the SocialLoginInit boot wrapper, the
// /api/log/ios-siwa-failure logging route, and the
// @capgo/capacitor-social-login dependency assumption. Single canonical
// path now: web OAuth via Supabase.
//
// Web OAuth is wired against Apple Services ID `app.cruzar.web` (commit
// 6bd4182, 2026-05-03 morning). Configuration on Apple's side:
//   - Services ID `app.cruzar.web` grouped with primary App ID
//     `7G5YNXPHWZ.app.cruzar.ios`
//   - Domain: cruzar.app
//   - Return URL: https://syxnylngrtogrnkfaxew.supabase.co/auth/v1/callback
// Configuration on Supabase's side:
//   - Apple provider enabled, Client IDs include `app.cruzar.web`
//   - Apple JWT secret generated from Apple .p8 (Key ID 8P87RKFSB4)
//
// If you're debugging "Sign up not complete" or any Apple-side error,
// the failure is upstream — Apple's side rejects before redirecting the
// code to Supabase, so neither the Supabase auth log nor our
// /auth/callback ever sees it. Diagnose via Apple Developer Support
// (1-800-633-2152). Apple-side configuration cannot be inspected via API.

export function AppleButton({
  label,
  next = '/welcome',
}: { label?: string; next?: string }) {
  const { lang } = useLang()
  const es = lang === 'es'
  const effectiveLabel = label ?? (es ? 'Continuar con Apple' : 'Continue with Apple')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Defer render until post-mount so SSR HTML never includes the button
  // on iOS app (Apple Review's webview can't catch a 1-frame flash of an
  // unclickable Apple button). Web/PWA users get a ~1-frame delay on
  // first paint which is invisible at human latency.
  const [ready, setReady] = useState(false)
  const [hideOnIOS, setHideOnIOS] = useState(false)

  useEffect(() => {
    setHideOnIOS(isIOSAppClient())
    setReady(true)
  }, [])

  if (!ready || hideOnIOS) return null

  async function handleApple() {
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app')

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          // skipBrowserRedirect: true → Supabase returns the OAuth URL
          // instead of navigating automatically. We assign manually with
          // window.location.assign which is more reliable than the
          // default href-set in PWA standalone mode.
          skipBrowserRedirect: true,
        },
      })

      if (oauthError || !data?.url) {
        setError(oauthError?.message || (es ? 'No se pudo iniciar con Apple' : 'Could not start Apple sign-in'))
        setLoading(false)
        return
      }

      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : (es ? 'Error desconocido' : 'Unknown error'))
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleApple}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-black text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-50 shadow-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        {loading ? (es ? 'Redirigiendo…' : 'Redirecting…') : effectiveLabel}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 text-center">
          {error}
        </p>
      )}
    </div>
  )
}
