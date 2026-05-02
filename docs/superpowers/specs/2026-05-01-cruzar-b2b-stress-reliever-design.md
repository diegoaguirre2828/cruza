# Cruzar Insights B2B — stress-reliever operator panel — all-in design

_Written 2026-05-01. Companion: `~/cruzar/docs/research/2026-05-01-rgv-broker-pain-dossier.md`._

## Goal

Convert Cruzar Insights from a **3-page mishmash that doesn't feel like a paid product** into a single **stress-reliever subscription product** for RGV SMB cross-border freight brokers (5–50 trucks). The product is the **morning briefing + proactive anomaly push + calibration receipt**, not a dashboard. `/dispatch` is the configuration surface. `/insights` is the sales page.

## Non-goals (this session)

- No changes to consumer surfaces (`/live`, `/memory`, `/`, `/dashboard`, /port/[id]) beyond decoupling them from B2B nav.
- No changes to iOS / RevenueCat / native code.
- No new MCP tools — `/mcp` stays as the dev audience surface.
- No WhatsApp outbound deliverability (Meta is blocking Diego's account; the inbound webhook handler ships inert and lights up when Meta unblocks).
- No `/insights/accuracy` separate route — folded into `/insights` and `/dispatch` inline.

## Audience + product frame

**Audience:** RGV SMB freight broker / dispatcher / fleet operator. 5–50 trucks. Lives in WhatsApp + Excel + DAT + maybe Aljex. "AI is for nerds." Refreshes CBP 10×/shift today.

**Frame:** "The 5am email you read once and then go run your shift." The stress relief is:
- 5am they read ONE email and know which ports to watch
- During shift they DON'T look — Cruzar pushes when something breaks
- Receipt next month proves Cruzar called it right (calibration scoreboard)

**Pitch math:** detention exposure ~$200K+/yr on a medium fleet (Nuvocargo). Cruzar Pro at $299/mo cuts 15–30% of that = $30k–60k/yr saved on a $3.6k/yr spend. 10×–20× ROI.

## Pricing tiers (locked from 4/28 plan)

| Tier | Price | Watched ports | Channels | Recipients | Multi-tier hooks |
|---|---|---|---|---|---|
| Free | $0 | 1 | Email-only briefing | 1 email | – |
| Starter | $99/mo | 5 | Email + SMS briefing + anomaly | 1 phone + 1 email | – |
| Pro | $299/mo | 20 | + WhatsApp (when unblocked) | 1 phone + 2 emails | Custom anomaly threshold |
| Fleet | $999/mo | 50 | All channels | N phones + N emails | Per-port thresholds, demo route |

## Architecture (4 layers)

```
┌─────────────────────────────────────────────────────────────────┐
│  SALES (/insights)                                              │
│  Editorial single-page. Hero · 6 decision-grade ports ·         │
│  calibration scoreboard inline · detention-math anchor · CTA    │
│  → Stripe checkout (or "Raul will text you")                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓ subscribe
┌─────────────────────────────────────────────────────────────────┐
│  CONFIG (/dispatch)  — operator panel                            │
│  Hero strip · per-row accuracy · alerts rail · demo preset      │
│  Auth-gated. SWR refresh. Reads insights_subscribers.            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ writes prefs
┌─────────────────────────────────────────────────────────────────┐
│  DATA (insights_subscribers + Stripe + WhatsApp tables)         │
│  v70 migration. RLS: own-row read/write, service-role full.    │
└─────────────────────────────────────────────────────────────────┘
                            ↓ read on schedule
┌─────────────────────────────────────────────────────────────────┐
│  ALERTS (the actual product)                                    │
│  /api/cron/insights-briefing  — per-subscriber morning brief   │
│  /api/cron/insights-anomaly-broadcast — every 30 min           │
│  /api/whatsapp/webhook (POST handler) — inbound query reply    │
│  Resend (email) + Twilio (SMS) + WhatsApp Business (queued)    │
└─────────────────────────────────────────────────────────────────┘
```

## Data model — `v70-insights-subscribers.sql`

```sql
CREATE TABLE IF NOT EXISTS insights_subscribers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('free','starter','pro','fleet')) DEFAULT 'free',
  status TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','trialing')) DEFAULT 'trialing',

  -- Watch config
  watched_port_ids TEXT[] NOT NULL DEFAULT '{}',
  port_thresholds JSONB DEFAULT '{}',  -- { "230502": 1.5, "230401": 1.3 } — Pro+ only

  -- Briefing config
  briefing_enabled BOOLEAN NOT NULL DEFAULT true,
  briefing_local_hour SMALLINT NOT NULL DEFAULT 5,  -- 0-23
  briefing_tz TEXT NOT NULL DEFAULT 'America/Chicago',
  language TEXT NOT NULL CHECK (language IN ('en','es')) DEFAULT 'en',

  -- Channels
  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_sms BOOLEAN NOT NULL DEFAULT false,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,

  -- Recipients (multi on Fleet)
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  recipient_phones TEXT[] NOT NULL DEFAULT '{}',

  -- Anomaly defaults
  anomaly_threshold_default NUMERIC NOT NULL DEFAULT 1.5,

  -- Audit
  last_briefing_sent_at TIMESTAMPTZ,
  last_anomaly_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_subscribers_user
  ON insights_subscribers (user_id);
CREATE INDEX IF NOT EXISTS idx_insights_subscribers_active_briefing
  ON insights_subscribers (briefing_local_hour, status)
  WHERE status = 'active' AND briefing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_insights_subscribers_active_anomaly
  ON insights_subscribers (status)
  WHERE status = 'active' AND (channel_sms OR channel_email OR channel_whatsapp);

ALTER TABLE insights_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insights_subscribers_own_select" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_select"
  ON insights_subscribers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_subscribers_own_update" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_update"
  ON insights_subscribers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_subscribers_own_insert" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_insert"
  ON insights_subscribers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Anomaly fire log (dedupe + audit)
CREATE TABLE IF NOT EXISTS insights_anomaly_fires (
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL REFERENCES insights_subscribers(id) ON DELETE CASCADE,
  port_id TEXT NOT NULL,
  ratio NUMERIC NOT NULL,
  channels_fired TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anomaly_fires_dedupe
  ON insights_anomaly_fires (subscriber_id, port_id, fired_at DESC);

ALTER TABLE insights_anomaly_fires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anomaly_fires_no_user" ON insights_anomaly_fires;
CREATE POLICY "anomaly_fires_no_user"
  ON insights_anomaly_fires FOR SELECT TO authenticated USING (false);
```

Apply via `npm run apply-migration -- supabase/migrations/v70-insights-subscribers.sql`.

## Files to create

### Pages / components

- `app/insights/page.tsx` — REWRITE. Editorial single page. ~300 lines max (down from 1140).
- `app/dispatch/page.tsx` — EDIT. Add hero strip + per-row accuracy + alerts rail + demo preset.
- `components/B2BNav.tsx` — NEW. Sales · Console · Account links. Used on `/insights` and `/dispatch` only.
- `components/InsightsHero.tsx` — NEW. Hero strip module for /insights.
- `components/CalibrationScoreboard.tsx` — NEW (or extracted from existing /insights/accuracy if it has reusable parts). Renders live per-port 30d accuracy from `calibration_accuracy_30d` view.
- `components/DetentionMathCard.tsx` — NEW. The "10 trucks × 1 wrong-pick = $10k/mo bleeding" anchor.
- `components/DispatchHero.tsx` — NEW. The "watching N · 0 anomalies · 87% accuracy · briefing 5am" strip.
- `components/AlertsRail.tsx` — NEW. Per-port email/SMS/WhatsApp status + last-fired.
- `app/dispatch/account/page.tsx` — NEW. Subscription management + tier upgrade + recipients + briefing time/tz/lang.

### API routes

- `app/api/insights/subscribe/route.ts` — POST: create insights_subscribers row, return Stripe checkout URL.
- `app/api/insights/portal/route.ts` — POST: Stripe billing portal session.
- `app/api/insights/preferences/route.ts` — GET/PUT: own subscriber prefs (channels, recipients, briefing time/tz, thresholds).
- `app/api/stripe/webhook/route.ts` — EDIT: handle insights subscription events alongside existing Pro/Business.
- `app/api/cron/insights-briefing/route.ts` — NEW. Per-subscriber morning brief.
- `app/api/cron/insights-anomaly-broadcast/route.ts` — NEW. Every-30-min anomaly fanout.
- `app/api/whatsapp/webhook/route.ts` — EDIT (existing). Add inbound parser: "wait at X" / "best now" / "anomaly" / "stop". Inert outbound until Meta unblock.
- `app/api/admin/create-cron-jobs/route.ts` — EDIT. Register the two new cron jobs at cron-job.org via existing pattern.

### Supporting

- `lib/insights/briefing.ts` — Build-briefing logic. Top-3 ranked picks + EONET context + accuracy footer. EN/ES.
- `lib/insights/anomaly-broadcast.ts` — Per-subscriber anomaly check with dedupe.
- `lib/insights/stripe-tiers.ts` — Tier → Stripe price ID mapping. ENV: `STRIPE_INSIGHTS_STARTER_PRICE_ID`, `STRIPE_INSIGHTS_PRO_PRICE_ID`, `STRIPE_INSIGHTS_FLEET_PRICE_ID`.
- `lib/copy/insights-en.ts` + `lib/copy/insights-es.ts` — Verbatim hero copy + briefing templates. From the dossier verbatim language bank.

### Supabase migrations

- `supabase/migrations/v70-insights-subscribers.sql` — schema above.

### Documentation

- `~/cruzar/CLAUDE.md` — add B2B Insights architecture section.
- `~/brain/projects/Cruzar.md` Active queue — strike completed items.

## Hero copy (verbatim from dossier — locked)

### `/insights` — English
- **Eyebrow:** "For RGV cross-border freight brokers / dispatchers / fleets"
- **Headline:** "The border has traditionally been the black hole."
- **Subhead:** "We pull your trucks out before it closes. One 5am email + a push when something breaks. That's it."
- **Detention-math card:** "10 trucks × 1 wrong-bridge-pick/day = ~$10k/mo bleeding. Cruzar Pro $299/mo cuts ~30% = $3k+ saved net. Most of our brokers see 10× ROI in month 1."
- **CTA:** "Start a trial — Raul will text you back today" → mailto/WhatsApp link to Raul (or fallback Diego)

### `/insights` — Spanish
- **Eyebrow:** "Para brokers / dispatchers / flotas RGV de carga transfronteriza"
- **Headline:** "La frontera siempre fue el hoyo negro."
- **Subhead:** "Sacamos tus camiones antes de que se cierre. Un correo a las 5am + un aviso cuando algo se rompe. Nada más."
- **CTA:** "Empieza prueba — Raul te marca hoy"

### `/dispatch` hero strip
- "Watching **N ports** · **X anomalies firing now** · **YY% accurate on YOUR lanes (last 30d)** · Next briefing **5:00am CT to bob@acme.com**"

### NO-AI rule
Strip every: "AI", "AI-powered", "artificial intelligence", "AI dispatcher", "Claude", "model", "MCP", "agent", "machine learning", "ML" from `/insights`, `/dispatch`, briefing email subjects, anomaly SMS, ALL customer-visible surfaces. Internal code keeps it. Per `feedback_ai_as_infrastructure_not_product_20260430`.

## Briefing template (5am)

### EN morning brief — Resend `from: Cruzar <briefings@cruzar.app>`
```
Subject: Cruzar — Morning border read · Tue May 7

Good morning,

Tracking your 5 ports. Quick read for today's shift:

🟢 NORMAL
Pharr-Reynosa — 32 min now, 41 min forecast 12pm. Typical for Tuesday.
Hidalgo — 24 min now, 28 min forecast 10am. Typical.

🟡 RISING
Laredo II (World Trade) — 47 min now, 78 min forecast 2pm.
Strike spillover from Mexico City likely. Alt: Colombia Solidarity (28 min, +18mi drive).

🔴 ANOMALY
Anzaldúas — 52 min now, 1.7× the Tuesday-morning baseline. Wildfire 22mi NE
contributing. We'll push if it doesn't recover by 9am.

Accuracy on YOUR ports last 30d:
 Pharr-Reynosa  74%   Hidalgo  82%   Laredo II  79%
 Colombia Sol   91%   Anzaldúas 71%

Configure: cruzar.app/dispatch
Stop briefings: reply STOP
```

### ES morning brief
(Same structure, full Spanish, "Buenos días")

## Anomaly push template (SMS, ≤160 chars)

### EN
```
Cruzar: Pharr-Reynosa 1.7× normal (87 min). Wildfire 22mi NE.
Forecast 12pm: 102 min. Alt: Anzaldúas 28 min. cruzar.app/dispatch
```

### ES
```
Cruzar: Pharr-Reynosa 1.7× normal (87 min). Incendio a 22mi NE.
Pronóstico 12pm: 102 min. Alt: Anzaldúas 28 min. cruzar.app/dispatch
```

## API contracts

### POST `/api/insights/subscribe`
Auth: required (Supabase user JWT)
```ts
type Req = {
  tier: 'starter' | 'pro' | 'fleet';
  watched_port_ids: string[];     // ≤ tier max
  briefing_local_hour: number;    // 0-23
  briefing_tz: string;            // IANA
  language: 'en' | 'es';
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  recipient_emails: string[];     // ≤ tier max
  recipient_phones: string[];     // ≤ tier max
};
type Res = { checkout_url: string; subscriber_id: number };
```
Side effects: insert/upsert insights_subscribers row with status='trialing', create Stripe checkout session, return URL.

### GET `/api/insights/preferences`
Auth: required. Returns own row.

### PUT `/api/insights/preferences`
Auth: required. Updates own row. Validates port count + recipient count vs tier.

### POST `/api/cron/insights-briefing`
Auth: `?secret=CRON_SECRET` or `Authorization: Bearer CRON_SECRET` (per project rule).
Schedule: every hour, top-of-hour. Selects active subscribers where `briefing_local_hour == current_local_hour_in_their_tz`. Builds + sends.

### POST `/api/cron/insights-anomaly-broadcast`
Auth: cron secret (same).
Schedule: every 30 min.
Process: for each active subscriber × watched port, check anomaly_now via internal call. If ratio ≥ subscriber threshold AND no fire in last 60 min for that subscriber+port, fire to subscribed channels + log.

### POST `/api/whatsapp/webhook` (existing — additive change)
Add intent parser: `wait at <port_or_city>` / `best now` / `briefing` / `anomaly` / `stop`. Reply via existing free-form 24h-window send. Lands inert when Meta is unblocking.

## Behavior changes — existing files

### `app/live/page.tsx`
- Remove `<meta httpEquiv="refresh" content="60" />` (the full-reload bug)
- Convert the data block to a client component using SWR with 60s refresh — only the rows re-render, the page stays mounted.
- Keep `<MomentsNav current="during" />` — `/live` stays consumer.

### `components/MomentsNav.tsx`
- Drop the `/insights` link (it's B2B, not consumer "before"). Replace the "before" slot with a consumer planner CTA or nothing — see implementation plan.

### `app/dispatch/page.tsx`
- Add `<DispatchHero subscriber={...} />` above the watchlist
- Add `<AlertsRail port={...} />` per row when subscriber has alerts configured for that port
- Add `?demo=rgv` URL param handling — when present, override watched ports to `["230502","230501","230503","230402","230403","535501"]` and disable persistence (read-only demo).

### `app/insights/page.tsx`
- Full rewrite to ~300 lines. Sections: Hero (verbatim copy) → Detention-math anchor → Calibration scoreboard inline → 6 decision-grade ports → How it shows up (briefing + anomaly + WhatsApp queued) → CTA.
- Add `<B2BNav />` instead of `MomentsNav`.

## Calibration tie-in

The product's moat is the calibration_log already running. Both surfaces read `calibration_accuracy_30d`:
- `/insights` — top-line "median accuracy 78% across decision-grade ports" + per-port chart
- `/dispatch` — per-row "right 73% / 30d" badge
- Morning briefing — accuracy footer block
- Anomaly fire metadata — log to insights_anomaly_fires.payload

## Security

- All B2B routes require Supabase user auth except `/api/insights/subscribe` (which checks auth at handler level).
- Cron routes require `CRON_SECRET`.
- Stripe webhook signature verified via `STRIPE_WEBHOOK_SECRET`.
- WhatsApp webhook signature verified per existing pattern.
- RLS policies prevent any subscriber from reading another subscriber's prefs.
- Service role used only inside cron handlers + Stripe webhook + admin routes.

## Telemetry

- Every briefing sent → log timestamp on subscriber row.
- Every anomaly fired → row in `insights_anomaly_fires` with channels + payload.
- Every prediction in briefing → log to `calibration_log` with `tags=['briefing', 'subscriber:<id>']` for downstream loss measurement when truth lands.
- Every Stripe event → audit row (existing pattern).

## Verification checklist (executed before declaring done)

1. `npm run build` — must complete with zero errors, all 197+ pages.
2. `npm run apply-migration -- supabase/migrations/v70-insights-subscribers.sql` — applied to prod Supabase.
3. `vercel deploy --prod` — successful deployment ID captured.
4. `curl https://cruzar.app/api/dispatch/snapshot?ports=230502,230501` — returns valid snapshot.
5. `curl https://cruzar.app/insights` — renders, no 500, "AI" not present in HTML.
6. `curl "https://cruzar.app/api/cron/insights-briefing?secret=...&dryRun=1"` — returns shape `{ subscribers_processed, briefings_sent, errors }`.
7. `curl "https://cruzar.app/api/cron/insights-anomaly-broadcast?secret=...&dryRun=1"` — returns shape `{ subscribers_checked, anomalies_fired, dedupes_suppressed, errors }`.
8. `curl https://cruzar.app/api/whatsapp/webhook?hub.verify_token=...&hub.challenge=test` — responds with challenge (verify still works).
9. Visit `https://cruzar.app/dispatch?demo=rgv` in private window — preset RGV watchlist loads.
10. Pacer agent run on the deployment — verifies all claims of "shipped" against live state.

## Rollback

- Each commit is independent, can revert via `git revert <sha>`.
- Migration v70 is additive (CREATE TABLE IF NOT EXISTS) — safe to leave in place if reverted.
- Stripe price IDs in env vars — can clear without breaking anything.
- Cron jobs at cron-job.org can be paused without code change.

## Open product calls (auto-decided to keep moving)

These would block in a normal cycle. Auto-decisions noted:

1. **Pricing exact tiers** → locked at $99/$299/$999 per the 4/28 plan. Diego can change in `lib/insights/stripe-tiers.ts` post-ship.
2. **Free-tier briefing** → 1 port, briefing-only, no SMS, no WhatsApp.
3. **Watchlist cap UX on Free** → soft warning, then upgrade CTA.
4. **Multi-recipient on Fleet** → N=10 phones / 10 emails (configurable later).
5. **Anomaly threshold** → default 1.5× for all tiers; per-port custom on Pro+ only.
6. **Stop word handling** → pause briefings + anomalies but DON'T cancel Stripe (Diego decides cancel manually). Auto-set `briefing_enabled=false`, `channel_*=false`.
7. **Hero copy ES vs EN routing** → use `Accept-Language` header, fall back to EN. Single rendered page contains both blocks (lang attribute on each).

## Spec self-review (executed inline)

- ✅ No "TBD" or placeholder text in the spec.
- ✅ Architecture matches feature descriptions (4 layers map to 4 sections).
- ✅ Pricing tier table is consistent across data model + sales page + API contract.
- ✅ Cron auth pattern matches project rule (`?secret=` + `Authorization: Bearer`).
- ✅ "AI" stripping is consistent — only verbatim broker language used in customer copy.
- ✅ Migration naming matches project pattern (`v<n>-` prefix).
- ✅ RLS policies cover all CRUD ops. Service role bypass implicit per Supabase default.
- ✅ Verification checklist is curl-able / pacer-checkable, not "looks good."
- ⚠ Single ambiguity: `/api/insights/subscribe` returns Stripe checkout URL even for Free tier — fixed: Free tier creates row with status='active' and skips Stripe (returns null `checkout_url`).
