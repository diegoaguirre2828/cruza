'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/auth'
import { useLang } from '@/lib/LangContext'
import { isIOSAppClient } from '@/lib/platform'
import { signInWithAppleNative } from '@/lib/socialLogin'

// Apple Sign-In button. Apple guideline 4.8 mandates Sign in with Apple
// any time the app offers another third-party identity provider (we do
// — Google).
//
// On iOS app builds (Capacitor) → native Apple sheet via
// @capgo/capacitor-social-login → Supabase signInWithIdToken. This was
// the fix for build-1.0(19) Apple Review rejection (guideline 4.0 +
// 2.1(a)) where the prior web-redirect flow pushed users to Safari and
// broke on iPad.
//
// On web / PWA → existing Supabase OAuth redirect flow. Different code
// path because the web has no native auth surface and the Apple Services
// ID config is what backs that flow on the desktop browser.

export function AppleButton({
  label,
  next = '/welcome',
}: { label?: string; next?: string }) {
  const { lang } = useLang()
  const router = useRouter()
  const es = lang === 'es'
  const effectiveLabel = label ?? (es ? 'Continuar con Apple' : 'Continue with Apple')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApple() {
    setError(null)
    setLoading(true)

    // iOS native path — opens the Apple system sheet, exchanges the
    // returned identity token with Supabase, and we navigate locally.
    if (isIOSAppClient()) {
      const result = await signInWithAppleNative()
      if (!result.ok) {
        setError(result.error || (es ? 'No se pudo iniciar con Apple' : 'Could not start Apple sign-in'))
        setLoading(false)
        return
      }
      router.push(next)
      return
    }

    // Web / PWA path — Supabase OAuth redirect.
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app')

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
          {es ? 'Error con Apple' : 'Apple sign-in failed'}: {error}
        </p>
      )}
    </div>
  )
}
