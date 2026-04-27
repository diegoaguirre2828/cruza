# lib/tracking

PostHog instrumentation for Cruzar. Generated from `.telemetry/tracking-plan.yaml` v1 (2026-04-26) by the `product-tracking-implement-tracking` skill.

## Files

| File | Purpose |
|------|---------|
| `events.ts` | Central registry of every PostHog event name + alias map for legacy snake_case names |
| `types.ts` | TypeScript interfaces for identify traits, group traits, and per-event properties |
| `posthog-client.ts` | Browser PostHog singleton (lazy init, internal-user opt-out) |
| `posthog-server.ts` | Node PostHog singleton + `trackServer()`, `identifyServer()`, `groupIdentifyServer()` for API routes |
| `identify.ts` | `identifyUser()`, `resetIdentity()`, `groupBusinessAccount()` |
| `track.ts` | One typed wrapper per event (`trackUserSignedUp`, `trackPortViewed`, ...) plus the legacy bridge `captureLegacy()` |
| `index.ts` | Public barrel export — import from `@/lib/tracking` |

## Setup

```bash
npm install posthog-js posthog-node
```

Set Vercel env vars (Production + Preview if you want preview-deploy events too):

| Env var | Required | Notes |
|---------|----------|-------|
| `NEXT_PUBLIC_POSTHOG_KEY` | yes (browser) | Project API key from app.posthog.com -> Project Settings |
| `NEXT_PUBLIC_POSTHOG_HOST` | optional | Defaults to `https://us.i.posthog.com`. EU: `https://eu.i.posthog.com`. |
| `POSTHOG_KEY` | yes (server) | Same key works |
| `POSTHOG_HOST` | optional | Same default as browser |
| `NEXT_PUBLIC_OWNER_EMAIL` | already set | Diego's email — internal-user opt-out checks this |

When `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` is unset every helper becomes a no-op. Safe to ship the code before the env var is configured.

## Browser usage

```typescript
import {
  identifyUser,
  resetIdentity,
  trackUserSignedUp,
  trackPortViewed,
  trackAlertCreated,
} from '@/lib/tracking';

// On signup completion
trackUserSignedUp({ method: 'email' });

// As soon as we have the Supabase user object
identifyUser(user, { tier: 'free', language: 'es', install_state: 'web' });

// On port detail view
trackPortViewed({
  port_id: '230401',
  port_name: 'Laredo I',
  direction: 'northbound',
  vehicle_wait: 25,
  source: 'home_saved',
});

// On logout
resetIdentity();
```

## Server usage (API routes, webhooks, cron)

Server helpers live in a separate entrypoint so `posthog-node` (which uses `node:fs`) is never pulled into client bundles:

```typescript
import { trackServer, flushServerPostHog } from '@/lib/tracking/posthog-server';

export async function POST(req: Request) {
  // ... handle the webhook ...
  await trackServer(userId, 'subscription.activated', {
    tier: 'pro',
    provider: 'stripe',
    mrr: 2.99,
  });
  return NextResponse.json({ ok: true });
}
```

`trackServer()` calls `shutdown()` internally so each capture flushes before the Vercel function freezes.

## Existing 81 call sites

The legacy `lib/trackEvent.ts` wrapper has been patched to forward every snake_case event into PostHog via `captureLegacy()`. **No existing call site needs to be edited.** The alias map in `events.ts` maps legacy names like `report_submitted` to the dotted PostHog form `report.submitted` and injects `variant`/`outcome` properties for collapsed event families (push prompts, install nudges).

## Demo wire-up

`app/signup/page.tsx` calls `trackUserSignedUp({ method })` and `identifyUser(...)` immediately after `supabase.auth.signUp()` resolves. This is the visible proof-of-life event; everything else flows through the legacy wrapper.

## Regenerating

After updating `.telemetry/tracking-plan.yaml`, re-run the implementation skill:

```
> implement tracking
```

The skill regenerates `events.ts`, `types.ts`, `track.ts`, and `index.ts` from the plan. Custom logic in `posthog-client.ts`, `posthog-server.ts`, and `identify.ts` is preserved.

## Verifying delivery

1. Open the app in a browser, run an event (signup, port view).
2. PostHog dashboard -> Activity -> Live Events.
3. Expect <5s latency from action to dashboard row.
4. Internal users (Diego's email) are opted out — events fire to Vercel Analytics + the Supabase `app_events` table only.
