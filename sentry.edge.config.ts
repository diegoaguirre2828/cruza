// Edge-runtime Sentry init — runs in the Edge runtime for the proxy
// convention (formerly middleware) and any route handlers configured
// with `runtime: 'edge'`. Cruzar's proxy.ts runs on edge, so this
// catches any proxy errors (including the Supabase auth refresh path
// that tripped up the GoTrue outage on 2026-04-14). Renamed to
// proxy.ts per Next 16 in commit 3af7cfb.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
})
