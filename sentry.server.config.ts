// Server-side Sentry init — runs in the Node.js runtime for every
// /api/* route and server component render. Loaded by
// instrumentation.ts on boot.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 1% sampling matches the client config (dropped from 10% on 2026-04-29
  // after hitting 80% of monthly quota mid-cycle). 1% is enough to surface
  // trend shifts; specific incidents come from Vercel Analytics + logs.
  tracesSampleRate: 0.01,

  // Server-side noise filters — same intent as the client config:
  // suppress patterns that produce volume without actionable signal.
  ignoreErrors: [
    // Vercel routing throws this on cancelled/aborted requests. Normal.
    /AbortError/,
    // Supabase auth re-validation can throw a benign "User from sub claim
    // does not exist" between rotations; the next request succeeds.
    /User from sub claim in JWT does not exist/,
  ],

  debug: false,
})
