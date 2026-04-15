// Server-side Sentry init — runs in the Node.js runtime for every
// /api/* route and server component render. Loaded by
// instrumentation.ts on boot.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% trace sampling matches the client config.
  tracesSampleRate: 0.1,

  // Uncomment to pipe Sentry's own logs through console during dev.
  debug: false,
})
