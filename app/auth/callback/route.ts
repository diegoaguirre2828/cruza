import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

// Supabase OAuth PKCE callback. Handles Google + Apple (and any future
// OAuth provider). Runs server-side, exchanges the PKCE code for a
// session, writes the cookie, then redirects to the final destination.
// Official Supabase pattern for Next.js App Router.
//
// Provider-error capture (added 2026-05-03 evening for the Apple "Sign
// up not complete" debugging): if the OAuth provider redirects here
// with `error=...&error_description=...` instead of a code (Apple does
// this when its Services ID is misconfigured, the user cancels, or the
// nonce/state validation fails server-side), we surface the verbatim
// provider error in Sentry + the user-facing /login page rather than
// silently treating it as "missing_code". Without this, Apple
// rejections were invisible — Apple POSTs the error to Supabase's
// callback (not ours), Supabase logs nothing, and the user just sees
// Apple's "Sign up not complete" page with no trail in our system.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/welcome'

  // Provider-error short-circuit. Capture verbatim before code-presence
  // logic so a `?error=...&error_description=...` redirect never falls
  // through to the missing-code branch.
  const oauthError = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  if (oauthError) {
    console.error('auth/callback: provider returned error', {
      error: oauthError,
      error_description: errorDescription,
      url: req.url,
    })
    Sentry.captureMessage('OAuth provider returned error', {
      level: 'error',
      tags: { auth_path: 'oauth_provider_error', error: oauthError },
      extra: { error: oauthError, error_description: errorDescription, full_url: req.url },
    })
    const friendly = errorDescription || oauthError
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(friendly)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Safe redirect — only allow local paths so we can't be used as
      // an open redirect.
      const target = next.startsWith('/') ? next : '/welcome'
      return NextResponse.redirect(`${origin}${target}`)
    }
    // Log to Sentry with tag so we can filter OAuth-exchange failures
    // specifically from other auth-path errors. Separately logged to
    // console for Vercel function logs (the two are both useful —
    // Sentry groups by fingerprint, Vercel by timestamp).
    console.error('auth/callback: exchange error', error)
    Sentry.captureException(error, {
      tags: { auth_path: 'oauth_exchange_failed' },
      extra: { code_present: true, next },
    })
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // No code present — user landed here by mistake. Also log as a
  // lower-severity Sentry event so we notice if this starts happening
  // often (would indicate a broken outbound link pointing at /auth/callback).
  Sentry.captureMessage('auth/callback reached without ?code param', {
    level: 'info',
    tags: { auth_path: 'oauth_missing_code' },
  })
  return NextResponse.redirect(`${origin}/login?error=missing_code`)
}
