# Delta: Current → Target — Cruzar

**Date:** 2026-04-26
**Destination:** PostHog (free tier, browser SDK + Node SDK)
**Total target events:** 41
**Sum check:** ADD (15) + RENAME (12) + KEEP (14) = 41 — valid.

## Architectural Changes

| Change | Detail |
|--------|--------|
| **Add PostHog SDK** | `posthog-js` (browser) + `posthog-node` (server). Initialize in `instrumentation-client.ts` for browser, lazy init in `lib/tracking/posthog-server.ts` for API routes. |
| **Add identify() flow** | Wire `posthog.identify(user.id, traits)` on auth state change in `lib/useAuth.ts`. On signOut call `posthog.reset()`. |
| **Add group() flow** | Wire `posthog.group('business_account', dispatcherId, traits)` whenever a tier='business' user fires an event in /business or /fleet routes. |
| **Add server-side tracking** | New `lib/tracking/server.ts` exposing `track(distinctId, name, props)` for Stripe webhooks, RevenueCat webhooks, /api/cron/send-alerts, /api/driver/checkin, /api/data-deletion. |
| **Add snapshot sync cron** | `/api/cron/posthog-traits-snapshot` runs daily, refreshes user trait counts (saved_crossings_count, alerts_count, points, share_count, last_active_at) and group traits (mrr, drivers_count, shipments_active_count). |
| **Keep existing wrappers** | `lib/trackEvent.ts`, `lib/trackShare.ts`, `lib/trackClick.ts` continue to work — refactored to also call `posthog.capture()`. Existing 81 call sites are NOT touched. |
| **Internal user exclusion** | `lib/tracking/index.ts` checks `profiles.email === OWNER_EMAIL` (Diego's address) and skips PostHog calls. Vercel Analytics + app_events still receive the event for admin debugging. |

## Add (15 events not currently tracked)

| Target Event | Category | Why |
|---|---|---|
| `user.signed_up` | lifecycle | Most critical missing event — funnel entry point |
| `user.signed_in` | lifecycle | Returning-user signal for retention |
| `user.signed_out` | lifecycle | Triggers `posthog.reset()` |
| `user.account_deleted` | lifecycle | Required for retention/churn analysis |
| `port.viewed` | core_value | The "check the wait time" moment — primary value action — currently not tracked |
| `crossing.saved` | core_value | Activation signal |
| `crossing.unsaved` | core_value | Symmetric pair |
| `alert.removed` | core_value | Symmetric pair to `alert.created` |
| `alert.delivered` | core_value | Server-side, proves the cron ran for the user |
| `alert.opened` | core_value | Closes the alert -> action loop |
| `smart_route.requested` | core_value | Pro feature engagement |
| `best_times.viewed` | core_value | Pro feature engagement |
| `report.upvoted` | core_value | Engagement signal currently invisible |
| `subscription.activated` / `.renewed` / `.canceled` | billing | Currently zero billing visibility — these come off Stripe + RevenueCat webhooks |
| `checkout.started` / `pricing.viewed` / `pricing_table.viewed` | billing/navigation | Conversion-funnel inputs |
| `referral.link_visited` | lifecycle | Currently not tracked |
| `language.changed` | configuration | Audience signal (ES vs EN preference) |
| `driver.added` / `.removed` / `.checked_in` | core_value | Business-tier core, currently zero events |
| `shipment.created` / `.status_changed` | core_value | Business-tier core, currently zero events |
| `fleet_dashboard.viewed` / `fleet_export.requested` | core_value | Business-tier engagement |

## Rename (12 — tracked today, renamed for consistency or clarity)

| Current Name | Target Name | Notes |
|---|---|---|
| `report_submitted` (4 sites, varying props) | `report.submitted` | Standardized props (port_id, report_type enum, wait_minutes, source enum) |
| `wait_confirm_vote` | `wait_confirm.voted` | Dotted form |
| `port_photo_submitted` | `photo.submitted` | Dotted form |
| `auto_crossing_started` | `auto_crossing.detected` | Verb clarity |
| `auto_crossing_confirmed` | `auto_crossing.confirmed` | Dotted form |
| `auto_crossing_rejected` | `auto_crossing.rejected` | Dotted form |
| `alert_created` (3 sites) + `one_tap_alert_created` | `alert.created` | Consolidated; one_tap becomes `source: 'one_tap'` |
| `affiliate_clicked` (5 sites, varying props) | `outbound.affiliate_clicked` | Standardized props |
| `pwa_grant_claimed` + `pwa_grant_claimed_manual` | `pwa_grant.claimed` | Consolidated; `manual: true|false` property |
| `home_visited` | `home.visited` | Dotted form |
| `install_completed` | `install.completed` | Dotted form + adds `source` property |

## Consolidate (28 -> 2 events)

| Currently | Consolidated to |
|---|---|
| `install_sheet_shown`, `post_signup_install_nudge_shown`, `pwa_welcome_install_tapped`, `twa_banner_shown`, `iab_banner_shown`, `camaras_install_cta_shown`, `camaras_sticky_shown`, `ios_install_page_view`, `install_prompt_available` | `install_nudge.shown` with `variant` enum |
| `install_sheet_dismissed`, `post_signup_install_nudge_dismissed`, `post_signup_install_nudge_tapped`, `pwa_welcome_install_choice`, `twa_banner_install_clicked`, `twa_banner_dismissed`, `iab_banner_dismissed`, `iab_banner_escape`, `camaras_install_cta_dismissed`, `camaras_install_cta_clicked`, `camaras_install_cta_choice`, `camaras_sticky_dismissed`, `camaras_sticky_clicked`, `ios_install_copy_link`, `ios_install_whatsapp`, `ios_install_skip`, `install_button_tapped`, `install_prompt_choice` | `install_nudge.resolved` with `variant` + `outcome` enums |
| `push_prompt_allow_clicked`, `push_prompt_granted`, `push_prompt_denied`, `push_prompt_dismissed` | `push.permission_resolved` with `outcome` enum + `push.permission_prompted` for shown |
| `outbound.affiliate_clicked` (5 sites) | one event with `partner` + `slot` properties |
| `report.submitted` (4 sites) | one event with `source` enum |
| `share` events (multiple channels and contexts) | `share.executed` with `channel` + `context` |

## Remove (low-signal, drop)

| Current Event | Why Remove |
|---|---|
| `home_header_toggled` | UI micro-interaction noise — no decision-grade signal |
| `home_panel_changed` | Navigation noise — `home.visited` with `panel` property covers it once |
| `inbound_source_tag` | Folded into `user.signed_up` via `source` property; standalone event is redundant |
| `servicios_page_view` | Replaced by automatic PostHog `$pageview` autocapture (PostHog tracks page views by default) |
| `pwa_grant_pending` (impression-style) | Trait, not event — model as user trait `pwa_grant_pending_until: datetime` |
| `pwa_grant_already_paid` | Trait, not event |
| `alert_nudge_shown` | Folded into `install_nudge.shown` family or dropped |
| `report_prompt_tapped` | UI engagement noise |
| `direction_toggled` | Property of `port.viewed` (`direction` already required) |
| `home_action_taken` | Splits into `port.viewed` with `source` and `crossing.saved` — covered |
| `planner_cta_tapped` | Folded into `smart_route.requested` |
| `insights_pill_tapped` | Folded into `insights.viewed` (target nav event) |
| `fb_page_pill_tap` | Redundant with `fb_page.follow_clicked` |

## Keep (14 — same name, same shape, no migration cost)

These existing events read as object.action even without the dot, and PostHog accepts them as-is. Keeping the name avoids a code edit at every call site:

| Event | Locations |
|---|---|
| `home_visited` (renamed -> `home.visited` only via the wrapper alias map; call sites unchanged) | HomeClient.tsx |
| `report_submitted` (renamed -> `report.submitted` via alias map) | 4 components |
| `alert_created` (renamed -> `alert.created` via alias map) | 3 sites |
| `affiliate_clicked` (renamed -> `outbound.affiliate_clicked` via alias map) | 5 sites |
| `auto_crossing_started/confirmed/rejected` | WaitingMode.tsx |
| `wait_confirm_vote` | WaitConfirmStrip.tsx |
| `port_photo_submitted` | SubmitBridgePhoto.tsx |
| `pwa_grant_claimed` / `_claimed_manual` (consolidated -> `pwa_grant.claimed`) | PWASetup, ClaimProInPwa |
| `fb_page_follow_click` (renamed -> `fb_page.follow_clicked`) | FbPagePill, FbPageFollowCard |
| `language change` (NEW — currently tracked nowhere) | LangContext (add) |

(Implementation note: the existing `lib/trackEvent.ts` wrapper gets a small alias map so legacy snake_case names route to the dotted PostHog event names without editing 81 call sites.)

## PII / Internal-User Audit

- **No PII in any event property** — `email`, `display_name`, `phone` never appear in event property keys. Validated against the full audit.
- **PII only in `identify()` traits** — `email` and `display_name` set on identify, marked `pii: true` in tracking-plan.yaml.
- **Internal user exclusion** — wrapper checks `profiles.email === process.env.OWNER_EMAIL` and short-circuits PostHog calls for Diego's own usage. Vercel Analytics and Supabase `app_events` continue to receive the event for admin debugging.

## Migration Risk

| Risk | Mitigation |
|------|-----------|
| 81 call sites use legacy names | Wrapper alias map. No call site is edited. |
| Vercel Analytics dashboards reference old names | They continue to receive the legacy names — wrapper double-fires (legacy name to Vercel, dotted name to PostHog). |
| Supabase `app_events` table queries reference old names | Same — `app_events` keeps receiving legacy names. |
| Stripe + RevenueCat webhooks aren't currently routed to anything | New: `lib/tracking/server.ts` consumed by webhooks; this is greenfield server-side instrumentation. |

## Implementation Order (sequenced for the next phase)

1. **Install + initialize PostHog** (browser + server) — `posthog-js`, `posthog-node`, env keys.
2. **Wire identify/reset/group** in `lib/useAuth.ts` and `lib/tracking/identify.ts`.
3. **Refactor `lib/trackEvent.ts`** to also call `posthog.capture()` with alias map. **Demo wire-up: instrument `user.signed_up` in the signup flow as the proof-of-life event.**
4. **Add new client-side calls** for missing core-value events (`port.viewed`, `crossing.saved`, `alert.delivered` opened, etc.).
5. **Server-side `track()` wrapper** + Stripe/RevenueCat webhook hooks.
6. **Daily snapshot cron** for trait sync.
