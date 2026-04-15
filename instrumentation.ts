// Next.js instrumentation hook — runs once per server/edge runtime
// on boot. We use it to initialize Sentry on whichever runtime is
// currently executing. The client-side init lives in
// instrumentation-client.ts (Next.js 15.3+ pattern).
//
// Sentry was wired into Cruzar on 2026-04-15 after a 12-hour silent
// GoTrue outage that nobody noticed until Diego tested Google login
// the next day. With Sentry + an onRequestError hook, the next
// /api/* route failure pages us within seconds instead of sitting
// invisible for half a day.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Re-exported under onRequestError as Next.js expects — the SDK's
// actual export is captureRequestError, we rename it here so the
// Next.js instrumentation lifecycle picks it up correctly.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
