'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/auth'
import { useLang } from '@/lib/LangContext'

// Detects Facebook / Instagram / TikTok in-app browsers, which are
// notorious for breaking OAuth flows — they block cross-origin
// redirects silently and trap users in a webview that can't complete
// the Google consent screen. If we detect one, we warn the user up
// front to open the page in the system browser instead of letting
// them tap the button and hit a dead end.
function detectInAppBrowser(): string | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/TikTok/i.test(ua)) return 'TikTok'
  if (/Line\//i.test(ua)) return 'Line'
  return null
}

// Detects PWA standalone mode. Used to log + adjust the redirect
// strategy because PWA standalone has quirky cross-origin navigation
// rules that plain browser tabs don't.
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari sets navigator.standalone; other platforms use the
  // display-mode media query.
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return !!nav.standalone || window.matchMedia?.('(display-mode: standalone)').matches
}

export function GoogleButton({
  label,
  next = '/welcome',
}: { label?: string; next?: string }) {
  const { lang } = useLang()
  const es = lang === 'es'
  // If no label provided, use bilingual default. Callers can still
  // override with an explicit label when they need custom copy (e.g.
  // "Sign in with Google" vs "Sign up with Google").
  const effectiveLabel = label ?? (es ? 'Continuar con Google' : 'Continue with Google')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stalled, setStalled] = useState(false)
  const [inAppBrowser, setInAppBrowser] = useState<string | null>(null)
  // Diagnostic — captured on each attempt so users can read the
  // actual redirect URL Supabase generated when the flow stalls.
  // No devtools needed to debug OAuth failures from a phone.
  const [debugUrl, setDebugUrl] = useState<string | null>(null)

  // Run detection on mount so guest users see the warning BEFORE
  // they tap the button and hit a broken OAuth flow.
  useEffect(() => {
    setInAppBrowser(detectInAppBrowser())
  }, [])

  async function handleGoogle() {
    setError(null)
    setStalled(false)
    setDebugUrl(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app')

      // skipBrowserRedirect: true tells Supabase to return the OAuth
      // URL instead of navigating automatically. We navigate manually
      // with window.location.assign, which is more robust than the
      // default `href = url` in PWA standalone mode — some mobile
      // browsers silently refuse cross-origin nav from that assignment
      // when installed as a PWA, leaving the user on a dead page.
      // This was the round-3 "signup funnel dead" bug: default redirect
      // ran but produced no navigation, so the 3s stall warning fired
      // on every single Google signup attempt from a PWA.
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          skipBrowserRedirect: true,
        },
      })

      if (oauthError || !data?.url) {
        setError(oauthError?.message || (es ? 'No se pudo iniciar con Google' : 'Could not start Google sign-in'))
        setLoading(false)
        return
      }

      // Capture the URL so we can display it on stall for diagnosis.
      setDebugUrl(data.url)

      // Manual navigation. window.location.assign() is the most
      // reliable cross-origin navigation in PWA standalone mode
      // across iOS Safari, Android Chrome, and Samsung Internet.
      // We DON'T use window.open(url, '_self') because it sometimes
      // opens a new tab the user never sees when run inside a PWA.
      window.location.assign(data.url)

      // Safety net: if assign() is silently blocked (extremely rare
      // but documented on some Android WebAPK builds), surface a
      // hint after 4 seconds instead of leaving the spinner forever.
      setTimeout(() => {
        setLoading(false)
        setStalled(true)
      }, 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : (es ? 'Error desconocido' : 'Unknown error'))
      setLoading(false)
    }
  }

  return (
    <div>
      {inAppBrowser && (
        <div className="mb-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-snug">
          <p className="font-bold mb-1">
            Abre esta página en tu navegador · Open in your browser
          </p>
          <p>
            {inAppBrowser} bloquea el inicio de sesión con Google. Toca los 3 puntos arriba y elige &ldquo;Abrir en Chrome / Safari&rdquo; — o usa email abajo.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? (es ? 'Redirigiendo…' : 'Redirecting…') : effectiveLabel}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 text-center">
          {es ? 'Error con Google' : 'Google sign-in failed'}: {error}
        </p>
      )}
      {stalled && !error && (
        <>
          <p className="mt-2 text-xs text-amber-600 text-center">
            {isStandalone()
              ? (es
                ? 'Google no abre en el modo app · cierra la app y abre cruzar.app en el navegador, o usa email abajo.'
                : "Google doesn't open in app mode — close the app, open cruzar.app in your browser, or use email below.")
              : (es
                ? '¿No redirigió? Toca el botón otra vez o usa email abajo.'
                : "Didn't redirect? Tap the button again, or use email below.")}
          </p>
          {debugUrl && (
            <details className="mt-2">
              <summary className="text-[10px] text-gray-500 cursor-pointer text-center">
                {es ? 'Info de depuración (toca pa\' ver)' : 'Debug info (tap to expand)'}
              </summary>
              <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-[9px] break-all font-mono text-gray-700 dark:text-gray-300">
                <p className="font-bold mb-1">{es ? 'URL de Supabase:' : 'Supabase redirect URL:'}</p>
                <p>{debugUrl}</p>
                <p className="font-bold mt-2">
                  {es
                    ? 'Abre esa URL en una pestaña nueva pa\' ver qué contesta Supabase.'
                    : 'Try opening this URL directly in a new tab to see what Supabase returns.'}
                </p>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
