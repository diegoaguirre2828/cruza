# Product: Cruzar

**Last updated:** 2026-04-26
**Method:** codebase scan + CLAUDE.md product brief (no live conversation — defaults applied per task brief)

## Product Identity
- **One-liner:** Border crossers open Cruzar, see live wait times for every US-Mexico crossing in their region, save the bridges they use, and get a push notification when the line drops below their threshold.
- **Category:** consumer-mobility / b2b-saas hybrid (free B2C wait-time app + paid Pro alerts + paid Business fleet tools)
- **Product type:** hybrid — most users are individual commuters/travelers (B2C), but the Business tier wraps a fleet/account model around dispatchers and their drivers (B2B)
- **Collaboration:** mostly single-player (commuters) with multiplayer sub-product on Business tier (dispatcher manages drivers + shipments)

## Business Model
- **Monetization:** freemium
- **Pricing tiers:**
  - **Guest** — $0, no account, can browse wait times + submit anonymous reports
  - **Free** — $0, account required, save crossings, leaderboard points, push opt-in
  - **Pro** — $2.99/mo, alerts (push/email/SMS), route optimizer, historical patterns, weekly digest
  - **Business** — $49.99/mo, fleet dashboard, drivers, shipments, cost calculator, CSV export
  - **Founder cohort** — capped lifetime/discounted slot (62/1000 currently filled)
- **Billing integration:** Stripe (web) + RevenueCat (iOS in-app purchases via Capacitor plugin)

## Tech Stack
- **Primary language:** TypeScript (strict)
- **Framework:** Next.js 16.2.4 (App Router) + React 19.2.4
- **Database:** Supabase (Postgres) with RLS; auth via `@supabase/ssr`
- **Background jobs:** No queue — scheduled via cron-job.org calling Next.js API routes (`/api/cron/*`)
- **HTTP client patterns:** native `fetch` + `lib/fetchWithTimeout.ts`
- **Module organization:** Next.js App Router (`app/`), shared components (`components/`), shared utilities (`lib/`), Supabase migrations (`supabase/migrations/`)
- **Mobile:** Capacitor 8.3.1 wrapping the Next.js web app for iOS (TestFlight build 20). Plugins: geolocation, push-notifications, preferences, splash-screen, status-bar, RevenueCat.
- **Other infra:** Vercel hosting, Sentry (`@sentry/nextjs`), Vercel Analytics + Speed Insights, Upstash Redis (rate-limit + KV), Vercel Blob, Resend (email), Web Push (VAPID), Twilio (SMS), Anthropic SDK (smart-route + briefing), MCP server (`/mcp`)

## Value Mapping

### Primary Value Action
**Check live wait time for a crossing the user cares about.** If users stop opening the app to check a wait time before crossing, the product has failed. Every other feature exists to bring them back to that moment or capitalize on it (alerts, saves, smart-route, fleet tools).

### Core Features (directly deliver value)
1. **Live wait times list + map** (`/`, `/mapa`) — the headline feature. Real-time CBP data per port, color-coded.
2. **Saved crossings / favorites** (`/favorites`, `lib/useFavorites.tsx`) — turns one-shot visitors into returning users by personalizing the home screen.
3. **Push alerts on threshold** (`alert_preferences`, `/api/cron/send-alerts`, `lib/usePushNotifications.ts`) — Pro-tier core, replaces the Facebook-group manual scrolling pattern.
4. **Smart-route / "best crossing right now"** (`/api/route-optimize`, `lib/smartRoute`) — Pro-tier decision overlay across nearby ports.
5. **Best-times historical patterns** (`/api/ports/[portId]/best-times`, `/predict`) — when to leave to avoid the line.
6. **Fleet dashboard + driver check-ins + shipments** (`/business`, `/fleet`, `/api/business/*`, `/api/driver/checkin`) — Business tier.
7. **PWA / iOS install** (`/ios-install`, `lib/installPromptStore.ts`, Capacitor) — install gate for promo eligibility, drives retention.

### Supporting Features (enable core actions)
1. **Auth** (`/login`, `/auth`, Supabase email + Google + Apple SIWA on iOS) — required to save, alert, upgrade.
2. **Community reports + upvotes** (`/api/reports`, `crossing_reports`) — fills CBP data gaps and creates engagement loop.
3. **Leaderboard + points + badges** (`/leaderboard`, `lib/points.ts`, `profiles.points`) — engagement / gamification on Free.
4. **Geofence "WaitingMode"** (`components/WaitingMode.tsx`, `lib/useCrossingDetector.ts`) — auto-detects user is at a crossing, prompts a quick report.
5. **Auto-crossing / inland checkpoint detection** (Phase 1 shipped 2026-04-25, `lib/inlandCheckpoints.ts`) — opt-in.
6. **Bilingual ES/EN toggle** (`lib/LangContext.tsx`) — required for the audience.
7. **Stripe checkout + RevenueCat IAP + customer portal** (`/api/stripe/*`, `lib/revenueCat.ts`) — upgrade path.
8. **Negocios directory** (`/negocios`, `rewards_businesses`) — adjacent feature, claim/free-listing flow.
9. **Exchange rate widget + community casa-de-cambio reports** (`/api/exchange`, `exchange_rate_reports`).
10. **Insights B2B landing** (`/insights`) — pre-revenue B2B wedge for SMB MX import/export decision overlay.
11. **MCP server** (`/mcp`) — distribution channel into Claude Code / Cursor.
12. **Video generator** (`/video-generator/`) — marketing input, not user-facing.
13. **Facebook native publisher** (`/api/cron/fb-*`, `lib/fbGraph.ts`) — marketing automation, not user-facing.
14. **Referrals** (`20260416_referrals.sql` migration, `/r/[code]`) — viral loop input to signups.
15. **Camera vision / bridge cameras** (`/camaras`, `lib/cameraVision.ts`, `lib/photoVision.ts`) — supplementary signal layer.

## Entity Model

### Users
- **ID format:** Supabase `auth.users.id` (UUID v4); mirrored 1:1 to `profiles.id`
- **Roles:** tier-based, not RBAC — `guest` (no row), `free`, `pro`, `business`. Plus implicit `admin` (Diego's email check on `/admin/*`).
- **Multi-account:** no — one Supabase user maps to one `profiles` row. iOS SIWA gets stitched into the same auth user via Supabase Apple provider.

### Accounts (Business tier only)
- **ID format:** the `profiles.id` of the dispatcher who pays for Business tier owns the account; drivers and shipments are scoped via `owner_user_id` foreign keys (no separate `accounts` table)
- **Hierarchy:** flat — one Business user "owns" N drivers and N shipments. No multi-dispatcher / sub-team concept.

### Drivers (sub-entity under Business account)
- **ID format:** `drivers.id` (UUID), accessed by drivers via signed token (no driver login)
- **Distinct from Users:** drivers do not have Supabase auth rows. Token-based check-in only.

### Shipments (sub-entity under Business account)
- **ID format:** `shipments.id` (UUID); status lifecycle (in line, at bridge, cleared, delivered)

## Group Hierarchy

```
Business Account (= dispatcher's profiles.id)
├── Drivers (token-keyed, no auth)
└── Shipments (status-tracked)
```

| Group Type | Parent | Where Actions Happen |
|------------|--------|---------------------|
| Business Account | (none) | dispatcher upgrades, exports CSV, manages roster |
| Driver | Business Account | check-ins, status updates (driver-side) |
| Shipment | Business Account | dispatch creates, status transitions, cost calculation |

**Default event level:** `user` (most events are individual commuters checking wait times). For Business tier features, group calls also fire on `business_account` so dispatcher revenue and roster size show up at the account level.

**Admin actions at:** Business Account level (driver/shipment CRUD, CSV export, fleet dashboard views).

## Current State
- **Existing tracking:**
  - `@vercel/analytics` — page-view aggregate metrics only (no custom events)
  - `@vercel/speed-insights` — Web Vitals
  - `@sentry/nextjs` — error monitoring (browser, server, edge)
  - **In-house lightweight wrappers** in `lib/`: `trackEvent.ts`, `trackClick.ts`, `trackShare.ts`, `useSessionPing.ts`. These appear custom/in-house — to be detailed by the audit phase.
- **Documentation:** none — no telemetry doc, no event dictionary
- **Known issues:**
  - Diego is "flying blind on what users do" — no funnel visibility
  - Business-critical events (signup completion, install, save, alert-set, upgrade) not currently fed to a product analytics destination
  - No identify/group calls — even existing event wrappers likely fire anonymously without binding to `profiles.tier` or Business account

## Integration Targets
| Destination | Purpose | Priority |
|-------------|---------|----------|
| **PostHog** (free tier, EU/US cloud or self-hosted) | Product analytics: events, funnels, retention, identify, groups, feature flags. Single source of truth for user behavior. | P0 — chosen per task brief |
| Vercel Analytics | Page-view + Web Vitals (already wired) — keep as-is | P3 (existing) |
| Sentry | Errors, perf — keep as-is, distinct from product analytics | P3 (existing) |
| Stripe + RevenueCat webhooks | Source of revenue truth — connect to PostHog via revenue events for MRR/LTV | P1 |

**Constraints:** PostHog free tier caps at 1M events/month and 5K session recordings/month — comfortably above current scale (278 signups). No event-name or property restrictions. Identify, group, capture, feature flags all available on free plan.

## Codebase Observations
- **Feature areas inferred from `app/` routes:**
  - Public/auth: `page.tsx`, `login`, `auth`, `account`, `reset-password`
  - Wait-time core: `port/[portId]`, `mapa`, `live`, `predict`, `compare`, `planner`, `cruzar`
  - Engagement: `favorites`, `dashboard`, `leaderboard`, `rewards`, `negocios`, `g` (groups?), `r` (referrals?)
  - Pro/Business: `business`, `fleet`, `for-fleets`, `operator`, `intelligence`, `express-cert`, `customs`, `insurance`, `insights`, `data`, `datos`
  - Marketing: `pricing`, `features`, `advertise`, `promoter`, `guide`, `mas`, `circle`, `city`, `bot`, `fb`, `camaras`
  - Mobile-only: `ios-install`, `checkin`, `driver`
  - Admin/system: `admin`, `api/*`, `mcp`, `data-deletion`, `privacy`
- **Entity model inferred from `supabase/migrations/`:** `profiles`, `crossing_reports`, `wait_time_readings`, `alert_preferences`, `push_subscriptions`, `saved_crossings`, `subscriptions`, `drivers`, `shipments`, `rewards_businesses`, `rewards_deals`, `rewards_redemptions`, `exchange_rate_reports`, `referrals` (per CLAUDE.md). v40 + 20260416_referrals are the most recent.
- **Workflows inferred from `/api/cron/`:** `fetch-wait-times` (15m), `send-alerts` (15m), `weekly-digest` (Mon 8am), plus FB native publisher crons. These are server-side and don't directly emit user-facing events but their downstream impact (alerts delivered, digests sent) is worth tracking.
