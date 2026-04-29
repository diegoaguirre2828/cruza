// Edge-runtime Sentry init — runs in the Edge runtime for the proxy
// convention (formerly middleware) and any route handlers configured
// with `runtime: 'edge'`. Cruzar's proxy.ts runs on edge, so this
// catches any proxy errors (including the Supabase auth refresh path
// that tripped up the GoTrue outage on 2026-04-14). Renamed to
// proxy.ts per Next 16 in commit 3af7cfb.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Dropped from 10% to 1% on 2026-04-29 (quota triage). Edge proxy
  // runs on every request, so the multiplier here is highest.
  tracesSampleRate: 0.01,
  ignoreErrors: [/AbortError/],
  debug: false,
})
