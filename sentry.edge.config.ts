// Edge-runtime Sentry init — runs in the Edge runtime for middleware
// and any route handlers configured with `runtime: 'edge'`. Cruzar's
// middleware.ts runs on edge, so this catches any middleware errors
// (including the Supabase auth refresh path that tripped up the
// GoTrue outage on 2026-04-14).
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
})
