# Current Instrumentation Architecture — Cruzar

**Date:** 2026-04-26

## SDKs in package.json

| Package | Version | Role |
|---------|---------|------|
| `@vercel/analytics` | ^2.0.1 | Aggregate page views + custom event sink (in-house wrapper forwards every event here) |
| `@vercel/speed-insights` | ^2.0.0 | Web Vitals; no product analytics |
| `@sentry/nextjs` | ^10.48.0 | Error monitoring, 10% perf traces, replay-on-error |
| (no PostHog / Amplitude / Mixpanel / Segment / Accoil installed) | — | — |

## Initialization

| Concern | Where |
|---------|-------|
| Vercel Analytics + Speed Insights mount | `app/layout.tsx` (`<Analytics />`, `<SpeedInsights />` at the body root) |
| Sentry browser init | `instrumentation-client.ts` (Next.js 15.3+ convention; ignore-rules for Supabase web-locks + iOS Safari fetch noise) |
| Sentry server/edge init | `instrumentation.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts` |
| Custom event wrapper | `lib/trackEvent.ts` (no init step — uses Vercel `track()` and POSTs to `/api/events/track`) |

No analytics SDK is initialized for product behaviour. The `trackEvent` wrapper has no init step — it's a pure function.

## Client vs Server

- **Tracking calls fire from the browser.** Every `trackEvent`, `trackShare`, `trackBusinessClick`, `trackLinkClick` call site is in a client component (`'use client'`).
- **Two sinks per `trackEvent`:**
  1. `vercelTrack(name, props)` from `@vercel/analytics` — direct browser-to-Vercel.
  2. `fetch('/api/events/track', { keepalive: true })` — browser POSTs to Next.js route, which writes to Supabase `app_events`.
- **Server route resolves identity** — `/api/events/track` calls `supabase.auth.getUser()` from the SSR cookie store and stamps `app_events.user_id` if signed in. No traits flow.
- **No server-side `trackEvent`** — no API route fires a product event after a server-mutated state change. Server-side observability is Sentry-only.

## Call Routing

```
Component button onClick
  -> trackEvent('snake_case_name', { props })   [lib/trackEvent.ts]
  -> vercelTrack(...)                            [Vercel Analytics dashboard]
  -> fetch('/api/events/track', { keepalive })   [server endpoint]
       -> rate-limit (120/h per user-or-ip)
       -> supabase.auth.getUser()  (resolve current user)
       -> db.from('app_events').insert({ event_name, props, session_id, user_id })
```

```
Component share button onClick
  -> trackShare('whatsapp', 'context')           [lib/trackShare.ts]
  -> fetch('/api/user/share-event', { keepalive })
       -> server increments profiles.share_count
```

```
Component negocio outbound click
  -> trackBusinessClick({ business_id, click_type, ... })  [lib/trackClick.ts]
  -> fetch('/api/track/click', { keepalive })
```

## Identity Management

| Call | Where | What |
|------|-------|------|
| `identify()` | none | not implemented |
| `group()` | none | not implemented |
| Implicit user resolution | server route `/api/events/track` | reads Supabase auth cookie -> stamps `user_id` on each event row |
| Profile heartbeat | `/api/user/touch` (driven by `lib/useSessionPing.ts`) | initial ping + 60s heartbeat while tab visible -> `profiles.last_seen_at` + device fields |
| Logout/reset | no analytics-specific reset | Supabase clears auth session |
| Session id | `sessionStorage['cruzar_session_id_v1']` | client-generated base36 timestamp + random; included in every `/api/events/track` POST |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry browser DSN |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase SSR client used by event ingest route |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role write to `app_events` table |
| Vercel Analytics | no env config — auto-detected by Vercel runtime |

## Error Handling

- **`trackEvent`:** every external call wrapped in try/catch with empty catch blocks; never throws. Vercel `track()` and `fetch()` failures swallowed silently.
- **`/api/events/track`:** insert call uses `.then(() => {}, () => {})` — DB errors swallowed; route always returns 200 unless input is malformed.
- **`trackShare` / `trackClick`:** `fetch().catch(() => {})` — fire-and-forget.
- **Sentry:** noisy ignore-list filters Supabase web-locks + iOS Safari fetch errors + Facebook in-app-browser injected handlers.

## Shutdown / Flush

- `keepalive: true` on every fetch — guarantees the request survives a same-tab navigation.
- No explicit flush() call anywhere.
- Vercel Analytics handles its own batching and flush (SDK-internal).

## What's Worth Preserving

- **Single client wrapper** (`lib/trackEvent.ts`) is a good shape — every call site already goes through one function. Adding PostHog as a third sink is a one-file edit.
- **`snake_case` event-naming convention** is uniformly applied. PostHog accepts these as-is.
- **`keepalive: true` + try/catch + fire-and-forget** are correct for production. Don't swap them out.
- **Session id pattern** is reusable — if PostHog identify() falls back to an anon distinct_id, the `cruzar_session_id_v1` can be used to thread guest sessions before login.
- **Server-side identity stamping** via `supabase.auth.getUser()` already works — porting this to PostHog server-side `identify()` after a Supabase auth event fits the same shape.

## What the Implementation Lacks

(Stating fact, not prescribing — design phase decides which to add.)

- No product analytics destination with funnels, retention, cohorts, group analytics
- No `identify()` call binding `profiles.tier`, `email`, `display_name`, `first_seen_at`, `share_count`, `points`, `install_state` to the analytics user
- No `group()` call binding Business-tier dispatchers to a `business_account` group with `mrr`, `driver_count`, `shipment_count`
- No event hooks on Stripe webhooks (subscription created, updated, canceled) — revenue events never reach product analytics
- No event hooks on RevenueCat purchase callbacks (iOS IAP)
- No event hooks on cron-driven side effects users care about (push delivered, weekly digest sent)
