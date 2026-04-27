# Instrumentation Guide

## Target: PostHog (browser + Node.js)

Generated from `tracking-plan.yaml` v1 on 2026-04-26. Reads against `current-implementation.md` (audit) — preserves the existing `lib/trackEvent.ts` wrapper as a third sink rather than replacing it.

**Plan:** PostHog Cloud, free tier (US region — `https://us.i.posthog.com`). Group analytics is a paid add-on; Cruzar's `business_account` group is wired but only one tier='business' user is expected pre-revenue, so this stays inside the free tier's group preview.

## SDK Setup

### Dependencies

```bash
npm install posthog-js posthog-node
```

Confirmed compatible: Next.js 16.2.4 + React 19.2.4 + Node 20+ (per `package.json`). PostHog publishes TS types — strict mode will pass.

### Initialization

**Browser** (extend the existing `instrumentation-client.ts` — Sentry already lives here):

```typescript
// instrumentation-client.ts (additions only)
import posthog from 'posthog-js';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-01-30',
    autocapture: false,            // Cruzar already has 53 manual events — do NOT add autocapture noise
    capture_pageview: true,        // automatic $pageview on route change (covers nav coverage)
    capture_pageleave: true,
    disable_session_recording: true, // Diego on free tier — session recordings off until needed
    persistence: 'localStorage+cookie',
    loaded: (ph) => {
      if (process.env.NODE_ENV !== 'production') ph.opt_out_capturing();
    },
  });
}
```

**Server** (new file `lib/tracking/posthog-server.ts`, lazy-singleton — Next.js serverless friendly):

```typescript
// lib/tracking/posthog-server.ts
import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

export function getServerPostHog(): PostHog | null {
  if (!process.env.POSTHOG_KEY) return null; // graceful no-op when env not set (preview deploys)
  if (!_client) {
    _client = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,         // serverless: flush every event — no long-lived process to batch
      flushInterval: 0,
    });
  }
  return _client;
}

// IMPORTANT: in Next.js serverless functions, you must await shutdown() at the
// end of the request to flush the queue before the function freezes.
export async function flushServerPostHog(): Promise<void> {
  if (_client) await _client.shutdown();
}
```

### Environment Variables

| Variable | Purpose | Required | Where set |
|----------|---------|----------|-----------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Browser project API key | yes (browser) | Vercel: Production + Preview |
| `NEXT_PUBLIC_POSTHOG_HOST` | API host (defaults to `https://us.i.posthog.com`) | no | Vercel |
| `POSTHOG_KEY` | Server-side personal/project key (same as browser key works) | yes (server) | Vercel: Production only |
| `POSTHOG_HOST` | Server-side host | no | Vercel |
| `OWNER_EMAIL` | Already set — used by internal-user exclusion check | yes (existing) | Vercel |

## Identity

### identify()

**Syntax (browser):**

```typescript
posthog.identify(distinctId: string, traits?: Record<string, unknown>)
```

**Syntax (server):**

```typescript
posthog.capture({ distinctId, event: '$identify', properties: { $set: traits } })
// or the dedicated method:
posthog.identify({ distinctId, properties: traits })
```

**User Traits** (from `tracking-plan.yaml` `entities.user.traits`):

| Trait | Type | PII | Notes |
|-------|------|-----|-------|
| `tier` | string enum (guest/free/pro/business) | no | required, on_change |
| `is_founder` | boolean | no | on_change |
| `install_state` | string enum (web/pwa/twa/capacitor) | no | on_change |
| `language` | string enum (es/en) | no | on_change |
| `home_region` | string | no | on_change |
| `signed_up_at` | datetime | no | one_time (use `$set_once`) |
| `first_seen_at` | datetime | no | one_time (use `$set_once`) |
| `last_active_at` | datetime | no | scheduled (heartbeat) |
| `pro_started_at` / `business_started_at` | datetime | no | on_change |
| `saved_crossings_count` / `alerts_count` / `reports_submitted_count` / `points` / `share_count` | integer | no | scheduled (daily cron) |
| `email` | string | **yes** | one_time |
| `display_name` | string | **yes** | on_change |

**When to Call:**

1. On signup completion — wire into Supabase `onAuthStateChange` (event === 'SIGNED_IN' AND first sign-in for this user)
2. On sign-in (returning user) — refresh traits
3. On profile traits changing (tier upgrade, language toggle, install_state flip)
4. Server-side from Stripe/RevenueCat webhooks when tier changes
5. Daily scheduled snapshot from `/api/cron/posthog-traits-snapshot`

**Template Code (browser, fired from auth state change):**

```typescript
// lib/tracking/identify.ts
import posthog from 'posthog-js';
import type { User } from '@supabase/supabase-js';

interface ProfileTraits {
  tier: 'guest' | 'free' | 'pro' | 'business';
  is_founder?: boolean;
  install_state?: 'web' | 'pwa' | 'twa' | 'capacitor';
  language?: 'es' | 'en';
  home_region?: string | null;
  display_name?: string | null;
  signed_up_at?: string;          // ISO from auth.users.created_at
  pro_started_at?: string | null;
  business_started_at?: string | null;
}

export function identifyUser(user: User, profile: ProfileTraits) {
  if (typeof window === 'undefined') return;

  // Internal-user exclusion — Diego's own logins don't pollute analytics
  if (user.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL) {
    posthog.opt_out_capturing();
    return;
  }

  posthog.identify(user.id, {
    // Set every event from now on
    tier: profile.tier,
    is_founder: profile.is_founder ?? false,
    install_state: profile.install_state ?? 'web',
    language: profile.language ?? 'es',
    home_region: profile.home_region ?? null,
    display_name: profile.display_name ?? null,
    pro_started_at: profile.pro_started_at ?? null,
    business_started_at: profile.business_started_at ?? null,
    email: user.email ?? null,
    // One-time only
    $set_once: {
      signed_up_at: profile.signed_up_at ?? user.created_at,
      first_seen_at: new Date().toISOString(),
    },
  });
}

export function resetIdentity() {
  if (typeof window === 'undefined') return;
  posthog.reset();
}
```

## group()

**Syntax (browser):**

```typescript
posthog.group(groupType: string, groupKey: string, traits?: Record<string, unknown>)
```

**Syntax (server):**

```typescript
posthog.groupIdentify({ groupType, groupKey, properties })
// AND on every event:
posthog.capture({ ..., groups: { business_account: 'profile-uuid' } })
```

**Group Hierarchy** (from `tracking-plan.yaml`):

| Level | SDK Group Type | ID Source | Parent |
|-------|---------------|-----------|--------|
| `business_account` | `business_account` | `profiles.id` of the dispatcher (UUID) | (none — top level) |

Cruzar's hierarchy is one level deep — drivers and shipments are sub-entities, not separate group types. PostHog supports up to 5 group types per project; this leaves headroom if `fleet` ever gets nested.

**Group Traits:**

| Trait | Type | Source |
|-------|------|--------|
| `name` | string | `profiles.display_name` of dispatcher |
| `plan` | string ('business') | constant |
| `mrr` | number (USD/month) | `subscriptions.amount` |
| `created_at` | datetime | `subscriptions.started_at` |
| `drivers_count` | integer | `COUNT(drivers WHERE owner_user_id=?)` |
| `shipments_active_count` | integer | `COUNT(shipments WHERE owner_user_id=? AND status NOT IN ('delivered','canceled'))` |
| `shipments_total_count` | integer | `COUNT(shipments WHERE owner_user_id=?)` |

**When to Call:**

1. **On business_account creation** — when a user's tier flips to `business` (Stripe webhook on `subscription.activated`).
2. **On trait change** — driver added/removed, shipment created/status changed, plan canceled (mrr -> 0).
3. **Scheduled daily** from `/api/cron/posthog-traits-snapshot` to refresh `mrr`, `drivers_count`, `shipments_active_count`.
4. **Browser session bootstrap** — on every page load for a tier='business' user, call `posthog.group('business_account', userId)` once after `identify()`. This is required because PostHog's browser SDK is stateful: only events fired AFTER `group()` are attributed to the group.

**Template Code (browser, after identify):**

```typescript
// lib/tracking/group.ts
import posthog from 'posthog-js';

interface BusinessAccountTraits {
  name?: string;
  mrr: number;
  created_at: string;            // ISO
  drivers_count: number;
  shipments_active_count?: number;
  shipments_total_count?: number;
}

export function groupBusinessAccount(
  dispatcherId: string,
  traits?: Partial<BusinessAccountTraits>,
) {
  if (typeof window === 'undefined') return;
  posthog.group('business_account', dispatcherId, {
    plan: 'business',
    ...traits,
  });
}

// Server-side equivalent (call from /api/cron/posthog-traits-snapshot):
//
// const ph = getServerPostHog()
// ph?.groupIdentify({
//   groupType: 'business_account',
//   groupKey: dispatcherId,
//   properties: { plan: 'business', mrr, drivers_count, ... },
// })
// await ph?.shutdown()
```

## Events

### track()

**Syntax (browser):**

```typescript
posthog.capture(eventName: string, properties?: Record<string, unknown>)
```

**Syntax (server):**

```typescript
posthog.capture({
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
  groups?: { business_account?: string },
})
```

**SDK Constraints:**

- PostHog allows arbitrary event names + properties — no name length cap that affects Cruzar (60-char audit cap stays via the existing `lib/trackEvent.ts`).
- **Property reserved keys** start with `$` (e.g., `$set`, `$set_once`, `$groups`) — Cruzar's existing snake_case props don't collide.
- **Server SDK is stateless.** Every server-side `capture()` for a Business event MUST pass `groups: { business_account: dispatcherId }` — there is no per-request stickiness.
- **`$pageview` is auto-captured.** The deprecated `servicios_page_view` event becomes redundant; remove its manual call.
- **Free-tier limits:** 1M events/month, 5K session recordings/month. At ~278 users + ~62 active, projected volume well under cap.

**Template Code:**

```typescript
// lib/tracking/track.ts
import posthog from 'posthog-js';

// Map of legacy snake_case names (in use today across 81 call sites) -> dotted PostHog names.
// Keeps the existing call sites untouched while feeding clean names into PostHog.
const EVENT_ALIAS: Record<string, string> = {
  home_visited: 'home.visited',
  report_submitted: 'report.submitted',
  alert_created: 'alert.created',
  one_tap_alert_created: 'alert.created',
  affiliate_clicked: 'outbound.affiliate_clicked',
  pwa_grant_claimed: 'pwa_grant.claimed',
  pwa_grant_claimed_manual: 'pwa_grant.claimed',
  install_completed: 'install.completed',
  fb_page_follow_click: 'fb_page.follow_clicked',
  wait_confirm_vote: 'wait_confirm.voted',
  port_photo_submitted: 'photo.submitted',
  auto_crossing_started: 'auto_crossing.detected',
  auto_crossing_confirmed: 'auto_crossing.confirmed',
  auto_crossing_rejected: 'auto_crossing.rejected',
  // Push prompt — collapse 4 events to 1 via outcome property
  push_prompt_granted: 'push.permission_resolved',
  push_prompt_denied: 'push.permission_resolved',
  push_prompt_dismissed: 'push.permission_resolved',
  push_prompt_allow_clicked: 'push.permission_prompted',
  // Install nudge variants — collapse to 2 events
  install_sheet_shown: 'install_nudge.shown',
  install_sheet_dismissed: 'install_nudge.resolved',
  // ... see lib/tracking/aliasMap.ts for the full list
};

const NUDGE_VARIANTS: Record<string, string> = {
  install_sheet_shown: 'first_visit_sheet',
  install_sheet_dismissed: 'first_visit_sheet',
  // ...
};

export function track(
  eventName: string,
  props?: Record<string, string | number | boolean | null | undefined>,
) {
  if (typeof window === 'undefined') return;
  const phName = EVENT_ALIAS[eventName] ?? eventName;
  const phProps: Record<string, unknown> = { ...(props ?? {}) };

  // If we collapsed an event family, inject the variant property derived from the legacy name.
  if (NUDGE_VARIANTS[eventName]) phProps.variant = NUDGE_VARIANTS[eventName];

  // Outcome inference for push.permission_resolved
  if (eventName === 'push_prompt_granted') phProps.outcome = 'granted';
  if (eventName === 'push_prompt_denied') phProps.outcome = 'denied';
  if (eventName === 'push_prompt_dismissed') phProps.outcome = 'dismissed';

  try {
    posthog.capture(phName, phProps);
  } catch { /* fire-and-forget */ }
}
```

### Group-Level Attribution

Cruzar has one group level (`business_account`). Browser attribution is automatic after `group()` is called once per session. Server-side requires explicit `groups: { business_account: id }` on every `capture()`.

```typescript
// Browser — fleet event after group() set on session bootstrap
posthog.capture('shipment.created', {
  shipment_id: 'shp_abc',
  port_id: '230401',
  // automatically attributed to business_account: <dispatcherId>
});

// Server — Stripe webhook for a Business-tier subscription event
import { getServerPostHog } from '@/lib/tracking/posthog-server';
const ph = getServerPostHog();
ph?.capture({
  distinctId: dispatcherUserId,
  event: 'subscription.activated',
  properties: { tier: 'business', provider: 'stripe', mrr: 49.99 },
  groups: { business_account: dispatcherUserId },
});
await ph?.shutdown();
```

User-level events (the vast majority — `port.viewed`, `report.submitted`, `alert.created`) carry no `groups`. PostHog rolls them up under the user's distinct_id only.

## Complete Tracking Module

The full code lives in `lib/tracking/`. The implementation phase will generate every file; this preview shows the structure that gets dropped in.

```typescript
// lib/tracking/index.ts — the public surface
//
// One-stop import for every callsite. Re-exports the new posthog-aware
// helpers AND keeps the legacy trackEvent/trackShare/trackBusinessClick names
// working so the 81 existing call sites keep compiling.

export { track } from './track';
export { identifyUser, resetIdentity } from './identify';
export { groupBusinessAccount } from './group';

// Legacy compatibility — re-export so existing imports keep working.
export { trackEvent } from '../trackEvent';
export { trackShare } from '../trackShare';
export { trackBusinessClick, trackLinkClick } from '../trackClick';
```

```typescript
// lib/tracking/posthog-server.ts (full file)
import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

export function getServerPostHog(): PostHog | null {
  if (!process.env.POSTHOG_KEY) return null;
  if (!_client) {
    _client = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

export async function flushServerPostHog(): Promise<void> {
  if (_client) await _client.shutdown();
}

// Lightweight server-side wrapper — used by webhooks, cron, and
// /api/data-deletion. Always fire-and-forget at the call site.
export async function trackServer(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
  opts: { businessAccountId?: string } = {},
): Promise<void> {
  const ph = getServerPostHog();
  if (!ph) return;
  ph.capture({
    distinctId,
    event,
    properties,
    groups: opts.businessAccountId ? { business_account: opts.businessAccountId } : undefined,
  });
  // Serverless: shutdown to flush the queue before the function freezes.
  await ph.shutdown();
}
```

```typescript
// lib/trackEvent.ts — patched to add PostHog as a third sink WITHOUT
// touching any of the 81 call sites.
import { track as vercelTrack } from '@vercel/analytics';
import { track as posthogTrack } from './tracking/track';

export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (typeof window === 'undefined') return;

  // Sink 1: Vercel Analytics (existing behavior)
  try {
    const vp: Record<string, string | number | boolean | null> = {};
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v === undefined) continue;
      vp[k] = v as string | number | boolean | null;
    }
    vercelTrack(eventName, vp);
  } catch { /* ignore */ }

  // Sink 2: app_events server log (existing behavior)
  try {
    fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: eventName, props: props || null }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }

  // Sink 3: PostHog (NEW — name aliasing + variant injection happens inside track())
  try { posthogTrack(eventName, props); } catch { /* ignore */ }
}
```

## Architecture

### Client vs Server

| Where | Calls | Notes |
|-------|-------|-------|
| **Browser** | `identify`, `reset`, `group`, `capture` for all user-driven events | Existing `lib/trackEvent.ts` already serves 81 call sites — extend, don't replace. |
| **Server (API routes)** | `capture` for Stripe webhooks, RevenueCat webhooks, `send-alerts` cron, `driver/checkin`, `data-deletion`, `posthog-traits-snapshot` cron | Use `trackServer()` and always `await ph.shutdown()` before returning the response. |

### Queues and Batching

- **Browser:** `posthog-js` batches in-memory and flushes every 5s or every 50 events (default). `keepalive: true` already used by Cruzar — PostHog's SDK uses the same primitive.
- **Server (Vercel serverless):** `flushAt: 1` + `flushInterval: 0` so each request flushes its own queue. Long-lived processes don't exist here.

### Shutdown / Flush

```typescript
// In every API route that calls trackServer():
import { flushServerPostHog } from '@/lib/tracking/posthog-server';

export async function POST(req: NextRequest) {
  // ... handler logic that calls trackServer(...) ...
  await flushServerPostHog();   // CRITICAL — without this, serverless freeze loses events
  return NextResponse.json({ ok: true });
}
```

`trackServer()` already calls `shutdown()` internally — the explicit `flushServerPostHog()` is only needed if multiple `trackServer()` calls fire in one request and you want one shutdown after all of them.

### Error Handling

- All client-side calls are wrapped in try/catch with empty handlers (matches existing pattern).
- Missing `POSTHOG_KEY` -> `getServerPostHog()` returns `null` -> graceful no-op. Preview deployments and local dev work without setting the key.
- `posthog.opt_out_capturing()` runs in dev (NODE_ENV !== 'production') and for internal users (email match) — those events are dropped silently.

## Verification

### Confirming Delivery

1. **Browser console:** `posthog.debug()` then `posthog.get_distinct_id()` — events log in real time.
2. **PostHog dashboard:** Activity -> Live Events. Expect <5s latency from `capture()` to dashboard row.
3. **Network tab:** look for `POST https://us.i.posthog.com/e/` requests, status 200.
4. **Server-side:** check Vercel function logs for the `posthog-node` HTTP call after `await shutdown()`.

### Expected Latency

- Browser: <5s on the Live Events feed; ~1 min for funnels and trends.
- Server: 1-3s on Live Events (single-event flush), same dashboard latency.

### Success vs Failure

| Status | Meaning |
|--------|---------|
| 200 from `/e/` | Event accepted |
| 401 | Bad project key — check env var |
| 429 | Rate-limited (shouldn't hit on free tier with current volume) |
| Network error / no log | `keepalive` masked the failure — check `posthog.debug()` output in browser |

### Development Testing

- **Local:** `posthog.opt_out_capturing()` runs automatically when `NODE_ENV !== 'production'`. Override by setting `NODE_ENV=production` locally + a separate `NEXT_PUBLIC_POSTHOG_KEY_DEV` if you want to test events.
- **Preview deploys (Vercel):** keep `NEXT_PUBLIC_POSTHOG_KEY` only in Production. Preview = no analytics noise.
- **Internal-user filter:** `OWNER_EMAIL` match short-circuits PostHog only — Vercel Analytics + `app_events` still receive Diego's actions for admin dashboard sanity-checks.

## Rollout Strategy

Phased — given Cruzar's pre-revenue state and 81 existing call sites, ship in 4 waves:

1. **Wave 1 — wiring + lifecycle (this commit).** Install SDKs, wire `instrumentation-client.ts` init, add `lib/tracking/*`, instrument `user.signed_up` (signup flow demo wire-up) + `user.signed_in` + `user.signed_out`. Verify on Vercel preview, then prod.
2. **Wave 2 — pipe existing events.** Patch `lib/trackEvent.ts` to feed PostHog. The 81 call sites flow into PostHog automatically with their legacy names + alias map. No code-site edits.
3. **Wave 3 — billing + Business tier.** Stripe webhook + RevenueCat webhook fire `subscription.activated/.renewed/.canceled`. Add `groupBusinessAccount` call after every business-tier event. Add server-side `alert.delivered` from `/api/cron/send-alerts`.
4. **Wave 4 — snapshot cron + group traits.** New `/api/cron/posthog-traits-snapshot` daily. Counts and MRR refresh. Promote PostHog to source-of-truth for retention dashboards.

## SDK-Specific Constraints

- **Group analytics is paid.** Free tier supports the call but dashboard analytics for groups are previewed only. Acceptable for current 0-1 Business customers.
- **Autocapture OFF.** Cruzar already has 53 manually-named events. Autocapture would create an unmaintainable parallel event stream.
- **`$pageview` ON.** Replaces all manual `*_page_view` events. The plan removes `servicios_page_view`.
- **`alias()` rarely needed.** PostHog stitches anon -> identified automatically on first `identify()`. Only call `alias()` if a guest's session_id needs to merge with a different identified user later.
- **Reserved property keys (`$set`, `$set_once`, `$groups`, `$pageview`)** must not collide with custom prop names. Audit confirms no Cruzar event uses a `$`-prefixed key.
- **Cookie/localStorage gates.** PWA + Capacitor iOS rely on `localStorage`; PostHog's `persistence: 'localStorage+cookie'` works in the WebView. iOS-Safari-with-cookies-blocked falls back to in-memory distinct_id.

## Coverage Gaps

- **Capacitor iOS native push.** PostHog's React Native SDK is not used; `posthog-js` runs inside the Capacitor WebView, which works for everything except true native push receipt. Receipt-side instrumentation (`alert.delivered` confirmed by device) requires a separate Capacitor plugin. Out of scope for now — server-side `alert.delivered` from `/api/cron/send-alerts` is the substitute.
- **MCP server (`/mcp`)** is a programmatic surface. Treat MCP tool calls as server events via `trackServer()` if/when MCP usage analytics matter — not in initial scope.
- **Video generator + FB native publisher** are admin/marketing tools, not user-facing. No PostHog instrumentation needed.
