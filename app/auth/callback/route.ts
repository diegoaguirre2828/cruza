import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

// Supabase OAuth (Google) PKCE callback.
//
// Without this route, Google signups fail silently in a couple of ways:
//   1. The client-side SDK has to detect the ?code= param and exchange it,
//      but by then Vercel has already served the /dashboard page with an
//      unauthenticated middleware pass, and the user bounces back to login.
//   2. Implicit-flow fallback loses the session on some browsers that
//      strip URL fragments.
//
// This route runs server-side, exchanges the PKCE code for a session,
// writes the cookie, and only then redirects to the final destination.
// Official Supabase pattern for Next.js App Router.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  // New signups and first-time OAuth logins land on /welcome so they hit
  // the mandatory alert-setup step. The /welcome page auto-redirects to
  // /dashboard if the user already has an alert, so returning users
  // bypass it transparently.
  const next = searchParams.get('next') || '/welcome'

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
