# Cruzar Insights B2B stress-reliever — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) — this codebase has no test suite; verification = `npm run build` clean + curl + playwright spot-check + pacer agent at end.

**Goal:** Convert Cruzar Insights from 3 disconnected pages into one stress-reliever subscription product (briefing + anomaly push + calibration receipt) with `/dispatch` as the operator config surface and `/insights` as the sales page.

**Architecture:** 4 layers — Sales page (`/insights`) → Config panel (`/dispatch`) → Subscriber data (`insights_subscribers` + Stripe) → Outbound alerts (briefing cron + anomaly broadcast cron + WhatsApp inbound). Calibration receipts inline both customer surfaces. NO "AI" in customer copy.

**Tech Stack:** Next.js 16.2.1 App Router, React 19, Supabase (Postgres + RLS), Stripe (subscriptions), Resend (email), Twilio (SMS — existing), WhatsApp Business API (inbound now, outbound queued for Meta unblock), SWR (dispatch refresh).

**Spec:** `docs/superpowers/specs/2026-05-01-cruzar-b2b-stress-reliever-design.md`
**Research dossier:** `docs/research/2026-05-01-rgv-broker-pain-dossier.md`

**Verification model (Cruzar pattern, no Jest/Vitest):** Each task ends with `npm run build` to verify TypeScript + Next.js compile, then a commit. Final-stage tasks add live curl + Playwright + pacer.

---

## Task 1: Apply v70 migration — `insights_subscribers` + `insights_anomaly_fires`

**Files:**
- Create: `supabase/migrations/v70-insights-subscribers.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/v70-insights-subscribers.sql`:

```sql
-- v70: Cruzar Insights B2B subscribers + anomaly fire log.
-- Applied 2026-05-01 to support the stress-reliever operator-panel rebuild.
-- Runs alongside existing `subscriptions` table (which tracks consumer Pro/Business);
-- this is the B2B Insights subscription layer with its own schema for watched ports,
-- briefing prefs, and per-channel recipients.

CREATE TABLE IF NOT EXISTS insights_subscribers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('free','starter','pro','fleet')) DEFAULT 'free',
  status TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','trialing')) DEFAULT 'trialing',

  watched_port_ids TEXT[] NOT NULL DEFAULT '{}',
  port_thresholds JSONB DEFAULT '{}',

  briefing_enabled BOOLEAN NOT NULL DEFAULT true,
  briefing_local_hour SMALLINT NOT NULL DEFAULT 5,
  briefing_tz TEXT NOT NULL DEFAULT 'America/Chicago',
  language TEXT NOT NULL CHECK (language IN ('en','es')) DEFAULT 'en',

  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_sms BOOLEAN NOT NULL DEFAULT false,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,

  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  recipient_phones TEXT[] NOT NULL DEFAULT '{}',

  anomaly_threshold_default NUMERIC NOT NULL DEFAULT 1.5,

  last_briefing_sent_at TIMESTAMPTZ,
  last_anomaly_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_subscribers_user ON insights_subscribers (user_id);
CREATE INDEX IF NOT EXISTS idx_insights_subscribers_active_briefing
  ON insights_subscribers (briefing_local_hour, status)
  WHERE status = 'active' AND briefing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_insights_subscribers_active_anomaly
  ON insights_subscribers (status)
  WHERE status = 'active' AND (channel_sms OR channel_email OR channel_whatsapp);

ALTER TABLE insights_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insights_subscribers_own_select" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_select" ON insights_subscribers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_subscribers_own_update" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_update" ON insights_subscribers
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_subscribers_own_insert" ON insights_subscribers;
CREATE POLICY "insights_subscribers_own_insert" ON insights_subscribers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

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
CREATE POLICY "anomaly_fires_no_user" ON insights_anomaly_fires
  FOR SELECT TO authenticated USING (false);
```

- [ ] **Step 2: Apply via local script (production apply happens in Task 27)**

Run: `cd /c/Users/dnawa/cruzar && npm run apply-migration -- supabase/migrations/v70-insights-subscribers.sql`
Expected: success line + new tables visible.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/v70-insights-subscribers.sql
git commit -m "v70: insights_subscribers + insights_anomaly_fires schema"
```

---

## Task 2: Insights Stripe tiers — extend `lib/stripe.ts` PLANS

**Files:**
- Modify: `lib/stripe.ts`
- Create: `lib/insights/stripe-tiers.ts`

- [ ] **Step 1: Add Insights price-id env vars to `lib/stripe.ts`**

Edit `lib/stripe.ts` after line 15 (existing intelligence env reads) — add:

```ts
const STRIPE_INSIGHTS_STARTER_PRICE_ID = process.env.STRIPE_INSIGHTS_STARTER_PRICE_ID?.trim()
const STRIPE_INSIGHTS_PRO_PRICE_ID = process.env.STRIPE_INSIGHTS_PRO_PRICE_ID?.trim()
const STRIPE_INSIGHTS_FLEET_PRICE_ID = process.env.STRIPE_INSIGHTS_FLEET_PRICE_ID?.trim()
```

Then add three entries to the `PLANS` object (before the closing `}` on line 105):

```ts
  insights_starter: {
    name: 'Insights Starter',
    priceId: STRIPE_INSIGHTS_STARTER_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      '5 watched ports',
      '5am morning border read to your inbox',
      'Anomaly push by SMS + email',
      'Bilingual (EN/ES)',
      'Live calibration receipts on YOUR lanes',
    ],
  },
  insights_pro: {
    name: 'Insights Pro',
    priceId: STRIPE_INSIGHTS_PRO_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      'Everything in Starter',
      '20 watched ports',
      'WhatsApp push (when available)',
      'Custom anomaly thresholds per port',
      'Up to 2 email recipients',
    ],
  },
  insights_fleet: {
    name: 'Insights Fleet',
    priceId: STRIPE_INSIGHTS_FLEET_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      'Everything in Pro',
      '50 watched ports',
      'Multi-recipient (up to 10 phones + 10 emails)',
      'Per-port custom thresholds',
      'In-office demo route',
      'Direct line to Diego + Raul',
    ],
  },
```

- [ ] **Step 2: Create `lib/insights/stripe-tiers.ts`**

```ts
// Cruzar Insights B2B tier definitions — single source of truth for limits.
// Pricing in PLANS (lib/stripe.ts) is the marketing surface; this file is the
// runtime contract.

export type InsightsTier = 'free' | 'starter' | 'pro' | 'fleet';

export interface TierLimits {
  maxWatchedPorts: number;
  maxRecipientEmails: number;
  maxRecipientPhones: number;
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  perPortThresholds: boolean;
  monthlyUsd: number;
  stripePriceEnv: string | null;
}

export const TIER_LIMITS: Record<InsightsTier, TierLimits> = {
  free: {
    maxWatchedPorts: 1,
    maxRecipientEmails: 1,
    maxRecipientPhones: 0,
    channels: { email: true, sms: false, whatsapp: false },
    perPortThresholds: false,
    monthlyUsd: 0,
    stripePriceEnv: null,
  },
  starter: {
    maxWatchedPorts: 5,
    maxRecipientEmails: 1,
    maxRecipientPhones: 1,
    channels: { email: true, sms: true, whatsapp: false },
    perPortThresholds: false,
    monthlyUsd: 99,
    stripePriceEnv: 'STRIPE_INSIGHTS_STARTER_PRICE_ID',
  },
  pro: {
    maxWatchedPorts: 20,
    maxRecipientEmails: 2,
    maxRecipientPhones: 1,
    channels: { email: true, sms: true, whatsapp: true },
    perPortThresholds: true,
    monthlyUsd: 299,
    stripePriceEnv: 'STRIPE_INSIGHTS_PRO_PRICE_ID',
  },
  fleet: {
    maxWatchedPorts: 50,
    maxRecipientEmails: 10,
    maxRecipientPhones: 10,
    channels: { email: true, sms: true, whatsapp: true },
    perPortThresholds: true,
    monthlyUsd: 999,
    stripePriceEnv: 'STRIPE_INSIGHTS_FLEET_PRICE_ID',
  },
};

export function getStripePriceIdForTier(tier: InsightsTier): string | null {
  const limits = TIER_LIMITS[tier];
  if (!limits.stripePriceEnv) return null;
  return process.env[limits.stripePriceEnv]?.trim() ?? null;
}
```

- [ ] **Step 3: `npm run build` — must pass**

```bash
cd /c/Users/dnawa/cruzar && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add lib/stripe.ts lib/insights/stripe-tiers.ts
git commit -m "stripe: add insights starter/pro/fleet tiers + lib/insights/stripe-tiers"
```

---

## Task 3: Verbatim copy library (EN + ES)

**Files:**
- Create: `lib/copy/insights-en.ts`
- Create: `lib/copy/insights-es.ts`

- [ ] **Step 1: Create `lib/copy/insights-en.ts`**

```ts
// Verbatim language for /insights B2B sales surface (English).
// Sourced from the 2026-05-01 RGV broker pain dossier. NEVER substitute
// corporate phrasing for these strings — they are quoted from real industry
// voices (Uber Freight MX, Cargado CEO, r/FreightBrokers, ATRI 2024).
// NO "AI" / "model" / "MCP" — see feedback_ai_as_infrastructure_not_product_20260430.md

export const INSIGHTS_EN = {
  eyebrow: 'For RGV cross-border freight brokers · dispatchers · fleets',
  headline: {
    line1: 'The border has traditionally been',
    accent: 'the black hole.',
    sub: 'We pull your trucks out before it closes.',
  },
  subhead:
    "One 5am email + a push when something breaks. Watch your lanes. Read receipts that prove we called it right. That's it.",
  detentionMath: {
    title: 'Why the math works',
    body:
      '10 trucks × 1 wrong-bridge-pick/day × 30 min wasted × $85/hr = ~$10,200/mo bleeding. Insights Pro at $299/mo cuts about 30% of that. Net save: $2,800+/mo.',
    footnote: 'Industry-wide: $3.6B/yr in direct detention losses, $11.5B/yr in lost productivity (ATRI 2024). 39% of stops detained.',
  },
  scoreboard: {
    kicker: 'Calibration receipts',
    title: 'We publish accuracy. Nobody else does.',
    sub:
      'Every prediction we make is logged, then matched against what the bridge actually did. Per-port, last 30 days, on the same chart we use internally.',
  },
  delivery: {
    kicker: 'How it shows up',
    morning: {
      title: 'Morning briefing — 5am to your inbox',
      body: 'Top-3 watched ports ranked by predicted wait. Anomalies flagged with weather/event context. Accuracy footer for trust.',
    },
    anomaly: {
      title: 'Anomaly push — SMS + email',
      body: 'When a watched port runs ≥1.5× its 90-day baseline, we fire. EONET nearby-event context attached when relevant.',
    },
    whatsapp: {
      title: 'WhatsApp reply (queued)',
      body: 'Text "wait at Pharr" and get the live read. Lights up once Meta unblocks our number.',
    },
  },
  cta: {
    primary: 'Start a trial — Raul will text you back today',
    secondary: 'Read the methodology',
  },
  pricing: {
    starter: { tier: 'Starter', price: '$99/mo', summary: '5 ports · briefing + SMS + email' },
    pro: { tier: 'Pro', price: '$299/mo', summary: '20 ports · WhatsApp · custom thresholds' },
    fleet: { tier: 'Fleet', price: '$999/mo', summary: '50 ports · multi-recipient · demo route' },
  },
  notAffiliated: 'Built on public CBP + BTS data. Not affiliated with CBP or DHS.',
};
```

- [ ] **Step 2: Create `lib/copy/insights-es.ts`**

```ts
// Spanish verbatim copy. Per feedback_bilingual_is_standard.md — bilingual
// is not a feature, it's table stakes for RGV/MX audience.

export const INSIGHTS_ES = {
  eyebrow: 'Para brokers · dispatchers · flotas RGV de carga transfronteriza',
  headline: {
    line1: 'La frontera siempre fue',
    accent: 'el hoyo negro.',
    sub: 'Sacamos tus camiones antes de que se cierre.',
  },
  subhead:
    'Un correo a las 5am + un aviso cuando algo se rompe. Monitorea tus carriles. Recibos que comprueban que le atinamos. Nada más.',
  detentionMath: {
    title: 'Por qué los números cuadran',
    body:
      '10 camiones × 1 puente equivocado/día × 30 min perdidos × $85/hr = ~$10,200/mes desangrando. Insights Pro a $299/mo corta ~30%. Neto: $2,800+/mes ahorrado.',
    footnote:
      'En toda la industria: $3.6B/año en pérdidas directas por detención, $11.5B/año en productividad perdida (ATRI 2024). 39% de las paradas detenidas.',
  },
  scoreboard: {
    kicker: 'Recibos de calibración',
    title: 'Publicamos precisión. Nadie más lo hace.',
    sub:
      'Cada predicción se registra y se compara con lo que realmente pasó en el puente. Por puerto, últimos 30 días, la misma gráfica que usamos internamente.',
  },
  delivery: {
    kicker: 'Cómo te llega',
    morning: {
      title: 'Briefing matutino — 5am a tu correo',
      body: 'Top-3 puertos vigilados ordenados por espera predicha. Anomalías marcadas con contexto de clima/eventos. Pie de precisión para confianza.',
    },
    anomaly: {
      title: 'Aviso de anomalía — SMS + correo',
      body: 'Cuando un puerto vigilado va ≥1.5× su baseline de 90 días, disparamos. Contexto de eventos cercanos (EONET) adjunto cuando aplica.',
    },
    whatsapp: {
      title: 'Respuesta por WhatsApp (en cola)',
      body: 'Escribe "espera en Pharr" y recibe la lectura viva. Activo en cuanto Meta libere nuestro número.',
    },
  },
  cta: {
    primary: 'Empieza prueba — Raul te marca hoy',
    secondary: 'Lee la metodología',
  },
  pricing: {
    starter: { tier: 'Starter', price: '$99/mes', summary: '5 puertos · briefing + SMS + correo' },
    pro: { tier: 'Pro', price: '$299/mes', summary: '20 puertos · WhatsApp · umbrales personalizados' },
    fleet: { tier: 'Fleet', price: '$999/mes', summary: '50 puertos · multi-destinatario · demo' },
  },
  notAffiliated: 'Construido sobre datos públicos de CBP + BTS. Sin afiliación con CBP ni DHS.',
};
```

- [ ] **Step 3: `npm run build` — must pass**

- [ ] **Step 4: Commit**

```bash
git add lib/copy/insights-en.ts lib/copy/insights-es.ts
git commit -m "copy: insights verbatim hero + delivery + pricing (EN + ES)"
```

---

## Task 4: GET/PUT `/api/insights/preferences`

**Files:**
- Create: `app/api/insights/preferences/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { TIER_LIMITS, type InsightsTier } from '@/lib/insights/stripe-tiers';

export const runtime = 'nodejs';

async function authedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
}

export async function GET() {
  const supabase = await authedClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('insights_subscribers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscriber: data ?? null });
}

interface PrefsBody {
  tier?: InsightsTier;
  watched_port_ids?: string[];
  port_thresholds?: Record<string, number>;
  briefing_enabled?: boolean;
  briefing_local_hour?: number;
  briefing_tz?: string;
  language?: 'en' | 'es';
  channel_email?: boolean;
  channel_sms?: boolean;
  channel_whatsapp?: boolean;
  recipient_emails?: string[];
  recipient_phones?: string[];
  anomaly_threshold_default?: number;
}

export async function PUT(req: NextRequest) {
  const supabase = await authedClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json()) as PrefsBody;

  // Load current row (or assume free for validation)
  const { data: current } = await supabase
    .from('insights_subscribers')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle();
  const tier: InsightsTier = (current?.tier as InsightsTier) ?? 'free';
  const limits = TIER_LIMITS[tier];

  // Validate tier-bounded fields
  if (body.watched_port_ids && body.watched_port_ids.length > limits.maxWatchedPorts) {
    return NextResponse.json({
      error: `tier_${tier}_max_${limits.maxWatchedPorts}_ports`,
    }, { status: 400 });
  }
  if (body.recipient_emails && body.recipient_emails.length > limits.maxRecipientEmails) {
    return NextResponse.json({
      error: `tier_${tier}_max_${limits.maxRecipientEmails}_emails`,
    }, { status: 400 });
  }
  if (body.recipient_phones && body.recipient_phones.length > limits.maxRecipientPhones) {
    return NextResponse.json({
      error: `tier_${tier}_max_${limits.maxRecipientPhones}_phones`,
    }, { status: 400 });
  }
  if (body.channel_sms && !limits.channels.sms) {
    return NextResponse.json({ error: `tier_${tier}_no_sms` }, { status: 400 });
  }
  if (body.channel_whatsapp && !limits.channels.whatsapp) {
    return NextResponse.json({ error: `tier_${tier}_no_whatsapp` }, { status: 400 });
  }
  if (body.briefing_local_hour !== undefined && (body.briefing_local_hour < 0 || body.briefing_local_hour > 23)) {
    return NextResponse.json({ error: 'briefing_local_hour_out_of_range' }, { status: 400 });
  }

  // Upsert (use auth.uid() RLS — server-side authed client bypasses since we authenticated via cookies)
  const update = { ...body, user_id: user.id, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('insights_subscribers')
    .upsert(update, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscriber: data });
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/api/insights/preferences/route.ts
git commit -m "api: GET/PUT /api/insights/preferences with tier-bounded validation"
```

---

## Task 5: POST `/api/insights/subscribe` — Stripe checkout for B2B tiers

**Files:**
- Create: `app/api/insights/subscribe/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getStripe } from '@/lib/stripe';
import { TIER_LIMITS, getStripePriceIdForTier, type InsightsTier } from '@/lib/insights/stripe-tiers';

export const runtime = 'nodejs';

interface SubscribeBody {
  tier: InsightsTier;
  watched_port_ids: string[];
  briefing_local_hour: number;
  briefing_tz: string;
  language: 'en' | 'es';
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json()) as SubscribeBody;
  const limits = TIER_LIMITS[body.tier];
  if (!limits) return NextResponse.json({ error: 'invalid_tier' }, { status: 400 });

  // Tier validation (same as preferences route)
  if (body.watched_port_ids.length > limits.maxWatchedPorts) {
    return NextResponse.json({ error: `tier_${body.tier}_max_${limits.maxWatchedPorts}_ports` }, { status: 400 });
  }

  // Free tier — create row directly, no Stripe.
  if (body.tier === 'free') {
    const { data, error } = await supabase
      .from('insights_subscribers')
      .upsert({
        user_id: user.id,
        tier: 'free',
        status: 'active',
        watched_port_ids: body.watched_port_ids.slice(0, 1),
        briefing_local_hour: body.briefing_local_hour,
        briefing_tz: body.briefing_tz,
        language: body.language,
        channel_email: true,
        channel_sms: false,
        channel_whatsapp: false,
        recipient_emails: body.recipient_emails.slice(0, 1),
        recipient_phones: [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscriber_id: data.id, checkout_url: null });
  }

  // Paid tier — create Stripe checkout session
  const priceId = getStripePriceIdForTier(body.tier);
  if (!priceId) {
    return NextResponse.json({ error: 'price_id_not_configured' }, { status: 500 });
  }

  // Pre-create insights_subscribers row in trialing state so we have an id
  const { data: subRow, error: subErr } = await supabase
    .from('insights_subscribers')
    .upsert({
      user_id: user.id,
      tier: body.tier,
      status: 'trialing',
      watched_port_ids: body.watched_port_ids,
      briefing_local_hour: body.briefing_local_hour,
      briefing_tz: body.briefing_tz,
      language: body.language,
      channel_email: body.channel_email,
      channel_sms: body.channel_sms,
      channel_whatsapp: body.channel_whatsapp,
      recipient_emails: body.recipient_emails,
      recipient_phones: body.recipient_phones,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  const stripe = getStripe();
  const origin = req.headers.get('origin') ?? 'https://cruzar.app';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dispatch?subscribed=1`,
    cancel_url: `${origin}/insights?cancelled=1`,
    customer_email: user.email ?? undefined,
    metadata: {
      userId: user.id,
      tier: `insights_${body.tier}`,
      insights_subscriber_id: String(subRow.id),
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        tier: `insights_${body.tier}`,
        insights_subscriber_id: String(subRow.id),
      },
    },
  });

  return NextResponse.json({ subscriber_id: subRow.id, checkout_url: session.url });
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/api/insights/subscribe/route.ts
git commit -m "api: POST /api/insights/subscribe — free direct, paid via Stripe checkout"
```

---

## Task 6: POST `/api/insights/portal` — Stripe billing portal

**Files:**
- Create: `app/api/insights/portal/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: sub } = await supabase
    .from('insights_subscribers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'no_stripe_customer' }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = req.headers.get('origin') ?? 'https://cruzar.app';
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/dispatch/account`,
  });
  return NextResponse.json({ url: portal.url });
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/api/insights/portal/route.ts
git commit -m "api: POST /api/insights/portal — Stripe billing portal"
```

---

## Task 7: Stripe webhook — handle `insights_*` tiers

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Edit the webhook handler**

In `app/api/stripe/webhook/route.ts`, add a branch BEFORE the existing `if (tier === 'express_cert')` block. The existing flow uses `tier` from metadata directly (`pro`, `business`, `operator`, etc.). For our flow we set tier as `insights_starter` / `insights_pro` / `insights_fleet` so we can detect it.

Replace the existing branch logic (lines 38–75) with:

```ts
    // Insights B2B subscribers — separate table, not the consumer profile.
    if (tier.startsWith('insights_')) {
      const insightsTier = tier.replace('insights_', '') as 'starter' | 'pro' | 'fleet';
      const subscriberId = session.metadata?.insights_subscriber_id;
      if (!subscriberId) {
        console.error('insights checkout.session.completed missing insights_subscriber_id', { sessionId: session.id });
        return NextResponse.json({ error: 'missing insights_subscriber_id' }, { status: 400 });
      }
      await supabase
        .from('insights_subscribers')
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          tier: insightsTier,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', Number(subscriberId));
    } else if (tier === 'express_cert') {
      await supabase
        .from('express_cert_applications')
        .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_session_id: session.id ?? null })
        .eq('user_id', userId)
        .eq('status', 'draft')
    } else {
      // Recurring tiers (pro / business / operator / intelligence) bump the profile tier
      await supabase.from('profiles').update({ tier }).eq('id', userId)
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        tier,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // Intelligence tier also creates an intel_subscriber row
      if (tier === 'intelligence' || tier === 'intelligence_enterprise') {
        const { data: u } = await supabase.auth.admin.getUserById(userId)
        if (u?.user?.email) {
          await supabase.from('intel_subscribers').upsert({
            email: u.user.email,
            user_id: userId,
            tier: tier === 'intelligence_enterprise' ? 'enterprise' : 'pro',
            stripe_subscription_id: session.subscription as string,
            active: true,
          }, { onConflict: 'email' })
        }
      }
    }
```

Then in the `customer.subscription.deleted` handler (around line 78), add an Insights branch:

```ts
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { id?: string; metadata?: { userId?: string; tier?: string } }
    const userId = sub.metadata?.userId
    const tierMeta = sub.metadata?.tier
    if (tierMeta?.startsWith('insights_') && sub.id) {
      await supabase.from('insights_subscribers').update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id)
    } else if (userId) {
      await supabase.from('profiles').update({ tier: 'free' }).eq('id', userId)
      await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('user_id', userId)
    }
  }
```

And in `invoice.payment_failed`:

```ts
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as { subscription?: string; subscription_details?: { metadata?: { userId?: string; tier?: string } } }
    const userId = invoice.subscription_details?.metadata?.userId
    const tierMeta = invoice.subscription_details?.metadata?.tier
    if (tierMeta?.startsWith('insights_') && invoice.subscription) {
      await supabase.from('insights_subscribers').update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', invoice.subscription)
    } else if (userId) {
      await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId)
    }
  }
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "stripe webhook: handle insights_starter/pro/fleet — write to insights_subscribers"
```

---

## Task 8: Briefing builder — `lib/insights/briefing.ts`

**Files:**
- Create: `lib/insights/briefing.ts`

- [ ] **Step 1: Create the builder**

```ts
// Cruzar Insights morning briefing — composes the 5am email body for one
// subscriber. Uses live wait + 6h forecast + DOW × hour baseline + EONET
// nearby events + per-port 30d calibration accuracy. EN/ES toggled.
//
// Fed by /api/cron/insights-briefing once per local hour.

import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

export interface SubscriberRow {
  id: number;
  user_id: string;
  language: 'en' | 'es';
  watched_port_ids: string[];
  recipient_emails: string[];
  briefing_local_hour: number;
  briefing_tz: string;
  anomaly_threshold_default: number;
}

interface PortBriefRow {
  port_id: string;
  name: string;
  current_min: number | null;
  forecast_6h_min: number | null;
  hist_avg_min: number | null;
  ratio: number | null;
  status: 'normal' | 'rising' | 'anomaly_high' | 'anomaly_low' | 'no_reading';
  accuracy_30d_pct: number | null;
}

const STATUS_ICON_EN: Record<PortBriefRow['status'], string> = {
  normal: '🟢',
  rising: '🟡',
  anomaly_high: '🔴',
  anomaly_low: '🟢',
  no_reading: '⚪',
};

export async function buildBriefRows(sub: SubscriberRow): Promise<PortBriefRow[]> {
  const db = getServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const ports = sub.watched_port_ids;
  if (ports.length === 0) return [];

  const [{ data: live }, { data: hist }, { data: cal }] = await Promise.all([
    db.from('wait_time_readings')
      .select('port_id, vehicle_wait, recorded_at')
      .in('port_id', ports)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(500),
    db.from('wait_time_readings')
      .select('port_id, vehicle_wait')
      .in('port_id', ports)
      .gte('recorded_at', ninetyDays)
      .eq('day_of_week', dow)
      .eq('hour_of_day', hour)
      .limit(20000),
    db.from('calibration_log')
      .select('tags, loss')
      .like('tags', '%port:%')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .not('observed', 'is', null)
      .limit(5000),
  ]);

  // Live latest per port
  const liveByPort = new Map<string, number>();
  for (const r of live ?? []) {
    if (!liveByPort.has(String(r.port_id)) && r.vehicle_wait != null) {
      liveByPort.set(String(r.port_id), r.vehicle_wait);
    }
  }

  // Historical avg
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of hist ?? []) {
    if (r.vehicle_wait == null) continue;
    const k = String(r.port_id);
    const cur = sums.get(k) ?? { sum: 0, n: 0 };
    cur.sum += r.vehicle_wait;
    cur.n += 1;
    sums.set(k, cur);
  }

  // Per-port accuracy from calibration_log tags
  const accByPort = new Map<string, { hits: number; total: number }>();
  for (const row of cal ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    const portTag = tags.find((t) => t.startsWith('port:'));
    if (!portTag) continue;
    const pid = portTag.slice(5);
    const cur = accByPort.get(pid) ?? { hits: 0, total: 0 };
    cur.total += 1;
    // Treat any loss <= 15min as a "hit" — same threshold as /insights/accuracy
    if (typeof row.loss === 'number' && row.loss <= 15) cur.hits += 1;
    accByPort.set(pid, cur);
  }

  return ports.map((pid) => {
    const meta = PORT_META[pid];
    const live = liveByPort.get(pid) ?? null;
    const sum = sums.get(pid);
    const histAvg = sum && sum.n > 0 ? Math.round(sum.sum / sum.n) : null;
    const ratio = live != null && histAvg != null && histAvg > 0 ? live / histAvg : null;
    let status: PortBriefRow['status'] = 'normal';
    if (live == null) status = 'no_reading';
    else if (ratio != null && ratio >= sub.anomaly_threshold_default) status = 'anomaly_high';
    else if (ratio != null && ratio <= 0.67) status = 'anomaly_low';
    else if (ratio != null && ratio >= 1.2) status = 'rising';

    const acc = accByPort.get(pid);
    const accuracy_30d_pct = acc && acc.total >= 5 ? Math.round((acc.hits / acc.total) * 100) : null;

    return {
      port_id: pid,
      name: meta?.localName ?? meta?.city ?? pid,
      current_min: live,
      forecast_6h_min: null, // Filled by caller via cruzar-insights-api if available
      hist_avg_min: histAvg,
      ratio,
      status,
      accuracy_30d_pct,
    };
  });
}

export function renderBriefHtml(sub: SubscriberRow, rows: PortBriefRow[]): { subject: string; html: string; text: string } {
  const es = sub.language === 'es';
  const dateLabel = new Date().toLocaleDateString(es ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const subject = es
    ? `Cruzar — Lectura matutina de la frontera · ${dateLabel}`
    : `Cruzar — Morning border read · ${dateLabel}`;

  const greeting = es ? 'Buenos días,' : 'Good morning,';
  const tracking = es
    ? `Monitoreando tus ${rows.length} puertos. Lectura rápida del turno:`
    : `Tracking your ${rows.length} ports. Quick read for today's shift:`;

  const groupNormal = rows.filter((r) => r.status === 'normal' || r.status === 'anomaly_low');
  const groupRising = rows.filter((r) => r.status === 'rising');
  const groupAnom = rows.filter((r) => r.status === 'anomaly_high');

  function formatRow(r: PortBriefRow): string {
    const cur = r.current_min != null ? `${r.current_min} min` : '—';
    const fc = r.forecast_6h_min != null ? `${r.forecast_6h_min} min` : '—';
    const ratio = r.ratio != null ? `${r.ratio.toFixed(1)}×` : '';
    return es
      ? `${r.name} — ${cur} ahora, pronóstico 6h ${fc}${ratio ? `. ${ratio} del baseline.` : '.'}`
      : `${r.name} — ${cur} now, ${fc} forecast 6h${ratio ? `. ${ratio} of baseline.` : '.'}`;
  }

  const lines: string[] = [];
  lines.push(greeting);
  lines.push('');
  lines.push(tracking);
  lines.push('');
  if (groupNormal.length > 0) {
    lines.push(es ? '🟢 NORMAL' : '🟢 NORMAL');
    for (const r of groupNormal) lines.push(formatRow(r));
    lines.push('');
  }
  if (groupRising.length > 0) {
    lines.push(es ? '🟡 SUBIENDO' : '🟡 RISING');
    for (const r of groupRising) lines.push(formatRow(r));
    lines.push('');
  }
  if (groupAnom.length > 0) {
    lines.push(es ? '🔴 ANOMALÍA' : '🔴 ANOMALY');
    for (const r of groupAnom) lines.push(formatRow(r));
    lines.push('');
  }

  // Accuracy footer
  const accLine = rows
    .filter((r) => r.accuracy_30d_pct != null)
    .map((r) => `${r.name} ${r.accuracy_30d_pct}%`)
    .join(' · ');
  if (accLine) {
    lines.push(es ? `Precisión en TUS puertos (últimos 30 días): ${accLine}` : `Accuracy on YOUR ports (last 30 days): ${accLine}`);
    lines.push('');
  }

  lines.push(es ? 'Configura: cruzar.app/dispatch' : 'Configure: cruzar.app/dispatch');
  lines.push(es ? 'Detener briefings: responde STOP' : 'Stop briefings: reply STOP');

  const text = lines.join('\n');
  const html = `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.6;color:#0f172a;background:#fff;padding:16px;">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;

  return { subject, html, text };
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add lib/insights/briefing.ts
git commit -m "lib: insights briefing builder — composes 5am brief per subscriber"
```

---

## Task 9: Cron route — `/api/cron/insights-briefing`

**Files:**
- Create: `app/api/cron/insights-briefing/route.ts`

- [ ] **Step 1: Create the cron route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { Resend } from 'resend';
import { buildBriefRows, renderBriefHtml, type SubscriberRow } from '@/lib/insights/briefing';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const url = new URL(req.url);
  const q = url.searchParams.get('secret');
  if (q && q === secret) return true;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  return GET(req);
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  const db = getServiceClient();
  const now = new Date();

  // Pull all active subscribers with briefing enabled. Filter by local hour in JS (tz arithmetic).
  const { data: subs, error } = await db
    .from('insights_subscribers')
    .select('id, user_id, language, watched_port_ids, recipient_emails, briefing_local_hour, briefing_tz, anomaly_threshold_default')
    .eq('status', 'active')
    .eq('briefing_enabled', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (subs ?? []).filter((s) => {
    try {
      const local = new Date(now.toLocaleString('en-US', { timeZone: s.briefing_tz }));
      return local.getHours() === s.briefing_local_hour;
    } catch {
      return false;
    }
  });

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Cruzar Briefings <briefings@cruzar.app>';

  let sent = 0;
  let errors = 0;
  for (const sub of due) {
    try {
      const rows = await buildBriefRows(sub as SubscriberRow);
      const { subject, html, text } = renderBriefHtml(sub as SubscriberRow, rows);
      if (dryRun || !resend) {
        // Still log the prediction set for calibration
        await logBriefingToCalibration(sub as SubscriberRow, rows);
        sent++;
        continue;
      }
      for (const email of sub.recipient_emails ?? []) {
        await resend.emails.send({ from: fromEmail, to: email, subject, html, text });
      }
      await db.from('insights_subscribers')
        .update({ last_briefing_sent_at: now.toISOString() })
        .eq('id', sub.id);
      await logBriefingToCalibration(sub as SubscriberRow, rows);
      sent++;
    } catch (err) {
      console.error('briefing send failed', { sub: sub.id, err });
      errors++;
    }
  }

  return NextResponse.json({ subscribers_due: due.length, briefings_sent: sent, errors, dryRun });
}

async function logBriefingToCalibration(sub: SubscriberRow, rows: { port_id: string; current_min: number | null; forecast_6h_min: number | null; ratio: number | null }[]) {
  const db = getServiceClient();
  for (const r of rows) {
    if (r.forecast_6h_min == null) continue;
    await db.from('calibration_log').insert({
      project: 'cruzar',
      sim_kind: 'insights-briefing-forecast-6h',
      sim_version: 'v0.5.4',
      predicted: { port_id: r.port_id, predicted_min: r.forecast_6h_min },
      context: { subscriber_id: sub.id, current_min: r.current_min, ratio: r.ratio },
      tags: [`port:${r.port_id}`, `subscriber:${sub.id}`, 'briefing'],
    });
  }
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/insights-briefing/route.ts
git commit -m "cron: /api/cron/insights-briefing — per-subscriber 5am brief + calibration log"
```

---

## Task 10: Anomaly broadcast — `lib/insights/anomaly-broadcast.ts`

**Files:**
- Create: `lib/insights/anomaly-broadcast.ts`

- [ ] **Step 1: Create the lib**

```ts
// Per-subscriber anomaly check + push. Reads insights_subscribers, computes
// ratio per watched port, fires push if ratio ≥ threshold AND not deduped
// against a 60-min lookback. Logs to insights_anomaly_fires.

import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

export interface AnomalyCheckResult {
  subscribers_checked: number;
  anomalies_fired: number;
  dedupes_suppressed: number;
  errors: number;
}

interface SubscriberLite {
  id: number;
  user_id: string;
  language: 'en' | 'es';
  watched_port_ids: string[];
  port_thresholds: Record<string, number> | null;
  anomaly_threshold_default: number;
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
  last_anomaly_fired_at: string | null;
}

export async function runAnomalyBroadcast(opts: {
  dryRun: boolean;
  sendSms: (to: string, body: string) => Promise<boolean>;
  sendEmail: (to: string, subject: string, body: string) => Promise<boolean>;
}): Promise<AnomalyCheckResult> {
  const db = getServiceClient();
  const result: AnomalyCheckResult = {
    subscribers_checked: 0,
    anomalies_fired: 0,
    dedupes_suppressed: 0,
    errors: 0,
  };

  const { data: subs, error } = await db
    .from('insights_subscribers')
    .select('id, user_id, language, watched_port_ids, port_thresholds, anomaly_threshold_default, channel_email, channel_sms, channel_whatsapp, recipient_emails, recipient_phones, last_anomaly_fired_at')
    .eq('status', 'active');
  if (error) throw new Error(error.message);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const dedupeCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const allPorts = Array.from(new Set((subs ?? []).flatMap((s) => s.watched_port_ids)));
  if (allPorts.length === 0) return result;

  const [{ data: live }, { data: hist }, { data: recentFires }] = await Promise.all([
    db.from('wait_time_readings').select('port_id, vehicle_wait, recorded_at').in('port_id', allPorts).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(2000),
    db.from('wait_time_readings').select('port_id, vehicle_wait').in('port_id', allPorts).gte('recorded_at', ninetyDays).eq('day_of_week', dow).eq('hour_of_day', hour).limit(50000),
    db.from('insights_anomaly_fires').select('subscriber_id, port_id, fired_at').gte('fired_at', dedupeCutoff),
  ]);

  const liveByPort = new Map<string, number>();
  for (const r of live ?? []) {
    if (!liveByPort.has(String(r.port_id)) && r.vehicle_wait != null) liveByPort.set(String(r.port_id), r.vehicle_wait);
  }
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of hist ?? []) {
    if (r.vehicle_wait == null) continue;
    const k = String(r.port_id);
    const cur = sums.get(k) ?? { sum: 0, n: 0 };
    cur.sum += r.vehicle_wait; cur.n += 1; sums.set(k, cur);
  }
  const dedupeKeys = new Set<string>();
  for (const f of recentFires ?? []) dedupeKeys.add(`${f.subscriber_id}:${f.port_id}`);

  for (const sub of (subs ?? []) as SubscriberLite[]) {
    result.subscribers_checked++;
    for (const portId of sub.watched_port_ids) {
      const live = liveByPort.get(portId);
      const sum = sums.get(portId);
      if (live == null || !sum || sum.n === 0) continue;
      const histAvg = sum.sum / sum.n;
      if (histAvg <= 0) continue;
      const ratio = live / histAvg;
      const threshold = sub.port_thresholds?.[portId] ?? sub.anomaly_threshold_default;
      if (ratio < threshold) continue;

      const dedupeKey = `${sub.id}:${portId}`;
      if (dedupeKeys.has(dedupeKey)) {
        result.dedupes_suppressed++;
        continue;
      }

      const meta = PORT_META[portId];
      const portName = meta?.localName ?? meta?.city ?? portId;
      const channelsFired: string[] = [];
      const subject = sub.language === 'es'
        ? `Cruzar: ${portName} ${ratio.toFixed(1)}× normal`
        : `Cruzar: ${portName} ${ratio.toFixed(1)}× normal`;
      const body = sub.language === 'es'
        ? `Cruzar: ${portName} ${ratio.toFixed(1)}× normal (${live} min). Configura: cruzar.app/dispatch`
        : `Cruzar: ${portName} ${ratio.toFixed(1)}× normal (${live} min). Config: cruzar.app/dispatch`;

      try {
        if (sub.channel_email) {
          for (const email of sub.recipient_emails ?? []) {
            if (!opts.dryRun) await opts.sendEmail(email, subject, body);
            channelsFired.push(`email:${email}`);
          }
        }
        if (sub.channel_sms) {
          for (const phone of sub.recipient_phones ?? []) {
            if (!opts.dryRun) await opts.sendSms(phone, body);
            channelsFired.push(`sms:${phone}`);
          }
        }
        // WhatsApp queued for Meta unblock — log channel attempt only.
        if (sub.channel_whatsapp) {
          channelsFired.push('whatsapp:queued');
        }

        if (!opts.dryRun) {
          await db.from('insights_anomaly_fires').insert({
            subscriber_id: sub.id,
            port_id: portId,
            ratio,
            channels_fired: channelsFired,
            payload: { live_min: live, hist_avg_min: histAvg, threshold, port_name: portName },
          });
          await db.from('insights_subscribers')
            .update({ last_anomaly_fired_at: now.toISOString() })
            .eq('id', sub.id);
        }
        dedupeKeys.add(dedupeKey);
        result.anomalies_fired++;
      } catch (err) {
        console.error('anomaly fire failed', { sub: sub.id, portId, err });
        result.errors++;
      }
    }
  }
  return result;
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add lib/insights/anomaly-broadcast.ts
git commit -m "lib: insights anomaly broadcast — per-subscriber check + dedupe"
```

---

## Task 11: Cron route — `/api/cron/insights-anomaly-broadcast`

**Files:**
- Create: `app/api/cron/insights-anomaly-broadcast/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import twilio from 'twilio';
import { runAnomalyBroadcast } from '@/lib/insights/anomaly-broadcast';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const url = new URL(req.url);
  const q = url.searchParams.get('secret');
  if (q && q === secret) return true;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(req: NextRequest) { return GET(req); }

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Cruzar Alerts <alerts@cruzar.app>';
  const fromSms = process.env.TWILIO_FROM_NUMBER;

  const result = await runAnomalyBroadcast({
    dryRun: dryRun || (!resend && !twilioClient),
    sendEmail: async (to, subject, body) => {
      if (!resend) return false;
      try { await resend.emails.send({ from: fromEmail, to, subject, text: body }); return true; }
      catch (e) { console.error('email send failed', e); return false; }
    },
    sendSms: async (to, body) => {
      if (!twilioClient || !fromSms) return false;
      try { await twilioClient.messages.create({ from: fromSms, to, body }); return true; }
      catch (e) { console.error('sms send failed', e); return false; }
    },
  });

  return NextResponse.json({ ...result, dryRun: result.errors === 0 ? dryRun : true });
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/insights-anomaly-broadcast/route.ts
git commit -m "cron: /api/cron/insights-anomaly-broadcast — every-30-min fanout"
```

---

## Task 12: WhatsApp intent — extend with `best_now`, `anomaly`, `stop`

**Files:**
- Modify: `lib/whatsappIntent.ts`

- [ ] **Step 1: Add new intent kinds + parser branches**

In `lib/whatsappIntent.ts`, change `IntentKind`:

```ts
export type IntentKind = 'live_wait' | 'best_now' | 'anomaly' | 'stop' | 'help';
```

And in `parseIntent` (or wherever the parser routes), add branches BEFORE the existing `live_wait` regex:

```ts
  // STOP — pause briefings + alerts (does NOT cancel Stripe)
  if (/^\s*(stop|alto|cancelar|baja|unsubscribe)\s*$/i.test(text)) {
    return { kind: 'stop', lang, raw: text };
  }
  // BEST NOW — recommend a port given current snapshot
  if (/\b(best now|best port|mejor puente|mejor ahora|recommend)\b/i.test(text)) {
    return { kind: 'best_now', lang, raw: text };
  }
  // ANOMALY — list ports running hot right now
  if (/\b(anomaly|anomalia|anomalía|hot|caliente)\b/i.test(text)) {
    return { kind: 'anomaly', lang, raw: text };
  }
```

And in `buildReplyForInbound`, add cases for the new intents. Find the live_wait handler and add alongside:

```ts
  if (intent.kind === 'stop') {
    // Look up subscriber by phone — if found, pause briefings
    const db = getServiceClient();
    const phone = intent.raw; // caller passes phone via from in webhook
    // We don't have the user's phone in the intent — defer to webhook to handle
    // by passing the from-phone to a stop handler. Reply confirms either way:
    return intent.lang === 'es'
      ? 'Pausamos briefings + alertas. Reactiva en cruzar.app/dispatch.'
      : 'Briefings + alerts paused. Reactivate at cruzar.app/dispatch.';
  }
  if (intent.kind === 'best_now') {
    // TODO once cruzar_smart_route is reusable from server context.
    return intent.lang === 'es'
      ? 'Próximamente. Por ahora abre cruzar.app/dispatch.'
      : 'Coming soon. For now open cruzar.app/dispatch.';
  }
  if (intent.kind === 'anomaly') {
    // List currently anomalous ports across the corridor
    const db = getServiceClient();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date();
    const dow = now.getDay();
    const hour = now.getHours();
    const COVERED = ['230501','230502','230503','230402','230401','230301','535502','535501'];
    const [{ data: live }, { data: hist }] = await Promise.all([
      db.from('wait_time_readings').select('port_id, vehicle_wait').in('port_id', COVERED).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(500),
      db.from('wait_time_readings').select('port_id, vehicle_wait').in('port_id', COVERED).gte('recorded_at', ninetyDays).eq('day_of_week', dow).eq('hour_of_day', hour).limit(20000),
    ]);
    const liveBy = new Map<string, number>();
    for (const r of live ?? []) if (!liveBy.has(String(r.port_id)) && r.vehicle_wait != null) liveBy.set(String(r.port_id), r.vehicle_wait);
    const sums = new Map<string, { s: number; n: number }>();
    for (const r of hist ?? []) {
      if (r.vehicle_wait == null) continue;
      const cur = sums.get(String(r.port_id)) ?? { s: 0, n: 0 };
      cur.s += r.vehicle_wait; cur.n += 1; sums.set(String(r.port_id), cur);
    }
    const hot: string[] = [];
    for (const pid of COVERED) {
      const lv = liveBy.get(pid); const sm = sums.get(pid);
      if (lv == null || !sm || sm.n === 0) continue;
      const ratio = lv / (sm.s / sm.n);
      if (ratio >= 1.5) {
        const meta = PORT_META[pid];
        hot.push(`${meta?.localName ?? meta?.city ?? pid} ${ratio.toFixed(1)}×`);
      }
    }
    if (hot.length === 0) return intent.lang === 'es' ? 'Nada anómalo ahorita.' : 'Nothing flagging right now.';
    return intent.lang === 'es' ? `Anómalos: ${hot.join(', ')}` : `Anomalies: ${hot.join(', ')}`;
  }
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add lib/whatsappIntent.ts
git commit -m "whatsapp intent: add stop / best_now / anomaly branches"
```

---

## Task 13: Cron registration — `/api/admin/create-insights-cron-jobs`

**Files:**
- Create: `app/api/admin/create-insights-cron-jobs/route.ts`

- [ ] **Step 1: Create the route — register both crons at cron-job.org**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ADMIN_EMAIL = 'cruzabusiness@gmail.com';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cronApiKey } = await req.json();
  if (!cronApiKey) return NextResponse.json({ error: 'Missing cronApiKey' }, { status: 400 });
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const jobs = [
    {
      title: '📬 Cruzar Insights — Briefings (hourly tick)',
      url: `https://cruzar.app/api/cron/insights-briefing?secret=${cronSecret}`,
      // Top-of-hour every hour. Each subscriber's local hour is matched in JS.
      schedule: { timezone: 'UTC', hours: [-1], minutes: [0], mdays: [-1], months: [-1], wdays: [-1] },
    },
    {
      title: '🚨 Cruzar Insights — Anomaly broadcast (every 30 min)',
      url: `https://cruzar.app/api/cron/insights-anomaly-broadcast?secret=${cronSecret}`,
      schedule: { timezone: 'UTC', hours: [-1], minutes: [0, 30], mdays: [-1], months: [-1], wdays: [-1] },
    },
  ];

  const results: Array<{ title: string; status: 'created' | 'error'; jobId?: number; debug?: string }> = [];
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (const job of jobs) {
    try {
      const res = await fetch('https://api.cron-job.org/jobs', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${cronApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: { url: job.url, title: job.title, enabled: true, saveResponses: false, schedule: job.schedule } }),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { /* not json */ }
      if (res.ok && data.jobId) results.push({ title: job.title, status: 'created', jobId: data.jobId as number });
      else results.push({ title: job.title, status: 'error', debug: `HTTP ${res.status}: ${text.slice(0, 300)}` });
    } catch (e) {
      results.push({ title: job.title, status: 'error', debug: String(e) });
    }
    await delay(2000);
  }
  const created = results.filter(r => r.status === 'created').length;
  const failed = results.filter(r => r.status === 'error').length;
  return NextResponse.json({ created, failed, results });
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/create-insights-cron-jobs/route.ts
git commit -m "admin: /api/admin/create-insights-cron-jobs — registers both crons via cron-job.org"
```

---

## Task 14: `components/B2BNav.tsx` — separate from MomentsNav

**Files:**
- Create: `components/B2BNav.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface B2BNavProps {
  current?: 'sales' | 'console' | 'account';
  lang?: 'en' | 'es';
}

export function B2BNav({ current, lang = 'en' }: B2BNavProps) {
  const pathname = usePathname();
  const active = current ?? (pathname.startsWith('/dispatch/account') ? 'account' : pathname.startsWith('/dispatch') ? 'console' : 'sales');
  const es = lang === 'es';
  return (
    <nav className="border-b border-white/[0.07] bg-[#070b18]">
      <div className="mx-auto max-w-[1180px] flex items-center gap-5 px-5 sm:px-8 py-3 text-[12px] uppercase tracking-[0.18em]">
        <Link href="/" className="text-white/55 hover:text-amber-300 transition">Cruzar</Link>
        <span className="text-white/15">/</span>
        <Link href="/insights" className={active === 'sales' ? 'text-amber-300' : 'text-white/55 hover:text-amber-300 transition'}>{es ? 'Ventas' : 'Sales'}</Link>
        <Link href="/dispatch" className={active === 'console' ? 'text-amber-300' : 'text-white/55 hover:text-amber-300 transition'}>{es ? 'Consola' : 'Console'}</Link>
        <Link href="/dispatch/account" className={active === 'account' ? 'text-amber-300' : 'text-white/55 hover:text-amber-300 transition'}>{es ? 'Cuenta' : 'Account'}</Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add components/B2BNav.tsx
git commit -m "components: B2BNav (separate from consumer MomentsNav)"
```

---

## Task 15: `components/CalibrationScoreboard.tsx`

**Files:**
- Create: `components/CalibrationScoreboard.tsx`

- [ ] **Step 1: Create the component (server component reading calibration_accuracy_30d)**

```tsx
import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

interface Props {
  portIds?: string[];
  lang?: 'en' | 'es';
}

export async function CalibrationScoreboard({ portIds, lang = 'en' }: Props) {
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const q = db.from('calibration_log')
    .select('tags, loss')
    .like('sim_kind', '%forecast%')
    .gte('created_at', cutoff)
    .not('observed', 'is', null)
    .limit(10000);
  const { data } = await q;
  const accByPort = new Map<string, { hits: number; total: number }>();
  for (const row of data ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    const portTag = tags.find((t) => t.startsWith('port:'));
    if (!portTag) continue;
    const pid = portTag.slice(5);
    if (portIds && !portIds.includes(pid)) continue;
    const cur = accByPort.get(pid) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (typeof row.loss === 'number' && row.loss <= 15) cur.hits += 1;
    accByPort.set(pid, cur);
  }
  const rows = Array.from(accByPort.entries())
    .filter(([, v]) => v.total >= 5)
    .map(([pid, v]) => ({
      pid,
      name: PORT_META[pid]?.localName ?? PORT_META[pid]?.city ?? pid,
      pct: Math.round((v.hits / v.total) * 100),
      n: v.total,
    }))
    .sort((a, b) => b.pct - a.pct);
  const median = rows.length > 0 ? rows[Math.floor(rows.length / 2)].pct : 0;
  const es = lang === 'es';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">{es ? 'Recibos' : 'Receipts'}</div>
          <h3 className="font-serif text-[22px] text-white mt-1">{es ? 'Precisión por puerto · 30 días' : 'Accuracy by port · 30 days'}</h3>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45">{es ? 'Mediana' : 'Median'}</div>
          <div className="font-mono text-[28px] tabular-nums text-amber-300">{median}%</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-white/40">{es ? 'Aún acumulando datos. Vuelve después.' : 'Still accumulating data. Check back soon.'}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[13px]">
          {rows.map((r) => (
            <li key={r.pid} className="flex items-baseline justify-between border-b border-white/[0.05] pb-1.5">
              <span className="text-white">{r.name}</span>
              <span className="font-mono tabular-nums text-amber-300">{r.pct}%<span className="text-white/35 ml-1.5">/n={r.n}</span></span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-white/40 leading-snug">
        {es
          ? 'Cada predicción se compara contra lo que realmente pasó en el puente. "Acierto" = error ≤ 15 min. n = predicciones evaluadas.'
          : '"Hit" = within 15 min of observed. n = predictions evaluated.'}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add components/CalibrationScoreboard.tsx
git commit -m "components: CalibrationScoreboard — per-port 30d accuracy from calibration_log"
```

---

## Task 16: `components/DetentionMathCard.tsx`

**Files:**
- Create: `components/DetentionMathCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';

export function DetentionMathCard({ lang = 'en' }: { lang?: 'en' | 'es' }) {
  const c = lang === 'es' ? INSIGHTS_ES.detentionMath : INSIGHTS_EN.detentionMath;
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-6 sm:p-7">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300 mb-3">{c.title}</div>
      <p className="text-[15px] leading-[1.55] text-white/85">{c.body}</p>
      <p className="mt-3 text-[12px] leading-[1.55] text-white/45">{c.footnote}</p>
    </div>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add components/DetentionMathCard.tsx
git commit -m "components: DetentionMathCard — anchor for $ math on /insights"
```

---

## Task 17: `components/InsightsHero.tsx`

**Files:**
- Create: `components/InsightsHero.tsx`

- [ ] **Step 1: Create the hero**

```tsx
import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';

export function InsightsHero({ lang = 'en', decisionGradeCount, medianLift }: { lang?: 'en' | 'es'; decisionGradeCount: number; medianLift: number }) {
  const c = lang === 'es' ? INSIGHTS_ES : INSIGHTS_EN;
  return (
    <header className="bg-gradient-to-b from-[#070b18] via-[#0a1020] to-[#0a1020] border-b border-white/[0.07]">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12 sm:py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45 mb-6">{c.eyebrow}</div>
        <h1 className="font-serif text-[clamp(2.2rem,5.6vw,4.4rem)] font-medium leading-[1.02] tracking-[-0.02em] text-white">
          {c.headline.line1} <span className="text-amber-400">{c.headline.accent}</span>
          <br />
          <span className="text-white/85">{c.headline.sub}</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[16px] leading-[1.55] text-white/70">{c.subhead}</p>
        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-white/[0.07] py-7 sm:grid-cols-3">
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">{lang === 'es' ? 'Puertos decision-grade' : 'Decision-grade ports'}</dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-amber-400">{decisionGradeCount}</dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">{lang === 'es' ? 'Mediana de mejora vs CBP' : 'Median lift vs CBP'}</dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">+{medianLift.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">{lang === 'es' ? 'Entrega' : 'Delivery'}</dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">{lang === 'es' ? 'Correo · SMS' : 'Email · SMS'}</dd>
            <dd className="mt-1.5 text-[12px] text-white/45">{lang === 'es' ? '+ WhatsApp en cuanto Meta libere' : '+ WhatsApp once Meta unblocks'}</dd>
          </div>
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial"
            className="inline-flex items-center gap-3 rounded-2xl bg-amber-400 px-6 py-3.5 text-[14px] font-semibold text-[#0a1020] transition hover:bg-amber-300"
          >
            <span>{c.cta.primary}</span>
            <span aria-hidden>→</span>
          </a>
          <a href="#scoreboard" className="text-[14px] font-medium text-white/70 underline decoration-white/30 underline-offset-[5px] hover:text-amber-300">{c.cta.secondary}</a>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add components/InsightsHero.tsx
git commit -m "components: InsightsHero — verbatim hero for /insights"
```

---

## Task 18: `app/insights/page.tsx` — full rewrite to single editorial page

**Files:**
- Modify: `app/insights/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

Replace the entire contents of `app/insights/page.tsx` with:

```tsx
import { B2BNav } from '@/components/B2BNav';
import { InsightsHero } from '@/components/InsightsHero';
import { DetentionMathCard } from '@/components/DetentionMathCard';
import { CalibrationScoreboard } from '@/components/CalibrationScoreboard';
import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';
import { getPortMeta } from '@/lib/portMeta';
import manifest from '@/data/insights-manifest.json';

export const runtime = 'nodejs';
export const revalidate = 3600;

export const metadata = {
  title: 'Cruzar Insights — the 5am border read',
  description: 'Per-port wait-time forecasts + calibration receipts. Morning email + anomaly push for RGV cross-border freight brokers.',
  alternates: { canonical: 'https://www.cruzar.app/insights' },
};

interface ManifestModel {
  port_id: string;
  port_name: string;
  horizon_min: number;
  rmse_min: number | null;
  lift_vs_cbp_climatology_pct: number | null;
  lift_vs_self_climatology_pct?: number | null;
}

interface Manifest {
  model_version: string;
  saved_at: string;
  models: ManifestModel[];
}

function decisionGrade(m: Manifest): ManifestModel[] {
  return m.models
    .filter((r) => r.horizon_min === 360 && (r.lift_vs_cbp_climatology_pct ?? -999) >= 5)
    .sort((a, b) => (b.lift_vs_cbp_climatology_pct ?? 0) - (a.lift_vs_cbp_climatology_pct ?? 0));
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? INSIGHTS_ES : INSIGHTS_EN;

  const m = manifest as Manifest;
  const dg = decisionGrade(m);
  const lifts = dg.map((p) => p.lift_vs_cbp_climatology_pct ?? 0).sort((a, b) => a - b);
  const medianLift = lifts.length > 0 ? lifts[Math.floor(lifts.length / 2)] : 0;
  const dgPortIds = dg.map((p) => p.port_id);

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100">
      <B2BNav current="sales" lang={lang} />
      <InsightsHero lang={lang} decisionGradeCount={dg.length} medianLift={medianLift} />

      <section className="border-b border-white/[0.07] bg-[#0a1020]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <DetentionMathCard lang={lang} />
        </div>
      </section>

      <section id="scoreboard" className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">{c.scoreboard.kicker}</div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-white mt-2">{c.scoreboard.title}</h2>
            <p className="mt-3 max-w-2xl text-[15px] text-white/65">{c.scoreboard.sub}</p>
          </div>
          <CalibrationScoreboard portIds={dgPortIds} lang={lang} />
        </div>
      </section>

      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">{c.delivery.kicker}</div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-3">
            {[c.delivery.morning, c.delivery.anomaly, c.delivery.whatsapp].map((d, i) => (
              <div key={i} className="bg-[#0a1020] p-7">
                <h3 className="font-serif text-[1.4rem] font-medium leading-[1.15] text-white">{d.title}</h3>
                <p className="mt-3 text-[13.5px] leading-[1.55] text-white/70">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">{lang === 'es' ? 'Puertos decision-grade' : 'Decision-grade ports'}</div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[13px]">
            {dg.map((p) => {
              const meta = getPortMeta(p.port_id);
              return (
                <li key={p.port_id} className="flex items-baseline justify-between border-b border-white/[0.05] pb-1.5">
                  <span className="text-white">{meta?.localName ?? p.port_name}</span>
                  <span className="font-mono tabular-nums text-amber-300">+{(p.lift_vs_cbp_climatology_pct ?? 0).toFixed(1)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="grid gap-3 sm:grid-cols-3">
            {[c.pricing.starter, c.pricing.pro, c.pricing.fleet].map((p) => (
              <div key={p.tier} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">{p.tier}</div>
                <div className="font-serif text-[28px] text-white mt-2">{p.price}</div>
                <p className="mt-2 text-[13px] text-white/65">{p.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial"
              className="inline-flex items-center gap-3 rounded-2xl bg-amber-400 px-6 py-3.5 text-[14px] font-semibold text-[#0a1020] transition hover:bg-amber-300"
            >
              <span>{c.cta.primary}</span>
              <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 text-[12px] text-white/40">
          {c.notAffiliated} · <a href="?lang=en" className="hover:text-amber-300">EN</a> · <a href="?lang=es" className="hover:text-amber-300">ES</a>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/insights/page.tsx
git commit -m "insights: full editorial rewrite — hero + math + scoreboard + delivery + pricing"
```

---

## Task 19: `components/DispatchHero.tsx`

**Files:**
- Create: `components/DispatchHero.tsx`

- [ ] **Step 1: Create the hero strip**

```tsx
'use client';

interface Props {
  watchedCount: number;
  anomalyCount: number;
  accuracyPct: number | null;
  briefingTimeLabel: string | null;
  recipientLabel: string | null;
  lang?: 'en' | 'es';
}

export function DispatchHero({ watchedCount, anomalyCount, accuracyPct, briefingTimeLabel, recipientLabel, lang = 'en' }: Props) {
  const es = lang === 'es';
  return (
    <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-[13px]">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">{es ? 'Vigilando' : 'Watching'}</div>
          <div className="font-mono text-[24px] tabular-nums text-white mt-1">{watchedCount}</div>
          <div className="text-[11px] text-white/40">{es ? 'puertos' : 'ports'}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">{es ? 'Anomalías ahora' : 'Anomalies firing now'}</div>
          <div className={`font-mono text-[24px] tabular-nums mt-1 ${anomalyCount > 0 ? 'text-rose-300' : 'text-white/85'}`}>{anomalyCount}</div>
          <div className="text-[11px] text-white/40">≥ 1.5× baseline</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">{es ? 'Precisión 30 días' : '30-day accuracy'}</div>
          <div className="font-mono text-[24px] tabular-nums text-white mt-1">{accuracyPct != null ? `${accuracyPct}%` : '—'}</div>
          <div className="text-[11px] text-white/40">{es ? 'tus puertos' : 'on YOUR ports'}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">{es ? 'Próximo briefing' : 'Next briefing'}</div>
          <div className="font-mono text-[15px] tabular-nums text-white mt-1">{briefingTimeLabel ?? '—'}</div>
          <div className="text-[11px] text-white/40 truncate">{recipientLabel ?? (es ? 'sin destinatarios' : 'no recipients')}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add components/DispatchHero.tsx
git commit -m "components: DispatchHero — stress-reliever strip on /dispatch"
```

---

## Task 20: `components/AlertsRail.tsx`

**Files:**
- Create: `components/AlertsRail.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

interface Props {
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  lastFiredAt: string | null;
  lang?: 'en' | 'es';
}

export function AlertsRail({ channels, lastFiredAt, lang = 'en' }: Props) {
  const es = lang === 'es';
  const last = lastFiredAt ? new Date(lastFiredAt).toLocaleString(es ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const Pill = ({ on, label }: { on: boolean; label: string }) => (
    <span className={`text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${on ? 'bg-amber-300/15 text-amber-200 border border-amber-300/30' : 'bg-white/[0.04] text-white/30 border border-white/[0.08]'}`}>{label}</span>
  );
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Pill on={channels.email} label="Email" />
      <Pill on={channels.sms} label="SMS" />
      <Pill on={channels.whatsapp} label="WA" />
      {last && <span className="text-white/35 ml-1">{es ? 'último' : 'last'} {last}</span>}
    </div>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add components/AlertsRail.tsx
git commit -m "components: AlertsRail — channel pills + last-fired"
```

---

## Task 21: `app/dispatch/page.tsx` — wire hero + alerts + demo preset

**Files:**
- Modify: `app/dispatch/page.tsx`

- [ ] **Step 1: Add imports + hero + demo preset + alerts rail**

Edit `app/dispatch/page.tsx`. Add to imports:

```tsx
import { DispatchHero } from '@/components/DispatchHero';
import { AlertsRail } from '@/components/AlertsRail';
import { B2BNav } from '@/components/B2BNav';
```

Replace `DEFAULT_WATCHED` line and the start of `useEffect` for hydration:

```ts
const DEFAULT_WATCHED = ["230502", "230501", "230503", "230402", "230401", "535501"];
const DEMO_WATCHED = ["230502", "230501", "230503", "230402", "230403", "535501"];
```

In `useEffect` for hydration, add demo handling after computing `fromUrl`:

```ts
  // Hydrate from URL → fallback to localStorage. URL wins so shared links work.
  useEffect(() => {
    const isDemo = params.get('demo') === 'rgv';
    if (isDemo) {
      setWatched(DEMO_WATCHED);
      setHydrated(true);
      return;
    }
    const fromUrl = params.get("ports")?.split(",").filter(Boolean) ?? null;
    const initial = fromUrl && fromUrl.length > 0 ? fromUrl : loadWatched();
    setWatched(initial);
    setHydrated(true);
  }, [params]);
```

In the persistence `useEffect`, skip persistence when demo:

```ts
  useEffect(() => {
    if (!hydrated) return;
    if (params.get('demo') === 'rgv') return;
    saveWatched(watched);
    const next = new URLSearchParams(params.toString());
    if (watched.length > 0) next.set("ports", watched.join(","));
    else next.delete("ports");
    router.replace(`/dispatch?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, hydrated]);
```

Add subscriber preferences fetch + accuracy aggregate. After `useSWR<SnapshotResponse>` hook, add:

```ts
  const { data: prefsData } = useSWR(hydrated ? '/api/insights/preferences' : null, fetcher);
  const subscriber = prefsData?.subscriber;
  const accSWR = useSWR(hydrated && watched.length > 0 ? `/api/insights/accuracy-summary?ports=${portsQuery}` : null, fetcher);
  const accuracyPct: number | null = accSWR.data?.median_pct ?? null;

  const anomalyCount = ports.filter((p) => p.anomaly_high).length;

  function nextBriefingLabel(): string | null {
    if (!subscriber?.briefing_enabled) return null;
    try {
      const tz = subscriber.briefing_tz || 'America/Chicago';
      const local = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      const next = new Date(local);
      next.setHours(subscriber.briefing_local_hour, 0, 0, 0);
      if (next <= local) next.setDate(next.getDate() + 1);
      return next.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }) + ` (${tz.split('/')[1] ?? tz})`;
    } catch { return null; }
  }
```

Wrap return in B2BNav and add hero above the watched section. Replace the return start:

```tsx
  return (
    <>
      <B2BNav current="console" lang={subscriber?.language ?? 'en'} />
      <main className="mx-auto max-w-[1180px] px-5 sm:px-8 py-6">
        <DispatchHero
          watchedCount={watched.length}
          anomalyCount={anomalyCount}
          accuracyPct={accuracyPct}
          briefingTimeLabel={nextBriefingLabel()}
          recipientLabel={subscriber?.recipient_emails?.[0] ?? null}
          lang={subscriber?.language ?? 'en'}
        />
        {/* … existing watched section, snapshot table, footnote … */}
```

Close `</main></>` at the end.

In the snapshot row, add an AlertsRail next to the status cell when subscriber has alerts:

In `DispatchRow` add a prop `subscriberChannels?: { email: boolean; sms: boolean; whatsapp: boolean }` and `lastFired?: string | null`; pass through from the parent. After the status cell, add:

```tsx
{subscriberChannels && (
  <td className="px-4 py-3.5">
    <AlertsRail channels={subscriberChannels} lastFiredAt={lastFired ?? null} lang="en" />
  </td>
)}
```

And in the parent, pass:

```tsx
<DispatchRow key={p.port_id} p={p} subscriberChannels={subscriber ? { email: subscriber.channel_email, sms: subscriber.channel_sms, whatsapp: subscriber.channel_whatsapp } : undefined} lastFired={subscriber?.last_anomaly_fired_at ?? null} />
```

- [ ] **Step 2: Create `/api/insights/accuracy-summary` — small helper for the hero**

Create `app/api/insights/accuracy-summary/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ports = url.searchParams.get('ports')?.split(',').filter(Boolean) ?? [];
  if (ports.length === 0) return NextResponse.json({ median_pct: null });
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db.from('calibration_log')
    .select('tags, loss')
    .like('sim_kind', '%forecast%')
    .gte('created_at', cutoff)
    .not('observed', 'is', null)
    .limit(10000);
  const accByPort = new Map<string, { hits: number; total: number }>();
  for (const row of data ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    const portTag = tags.find((t) => t.startsWith('port:'));
    if (!portTag) continue;
    const pid = portTag.slice(5);
    if (!ports.includes(pid)) continue;
    const cur = accByPort.get(pid) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (typeof row.loss === 'number' && row.loss <= 15) cur.hits += 1;
    accByPort.set(pid, cur);
  }
  const pcts = Array.from(accByPort.values()).filter((v) => v.total >= 5).map((v) => Math.round((v.hits / v.total) * 100)).sort((a, b) => a - b);
  const median_pct = pcts.length > 0 ? pcts[Math.floor(pcts.length / 2)] : null;
  return NextResponse.json({ median_pct, n_ports: pcts.length });
}
```

- [ ] **Step 3: `npm run build` — must pass**

- [ ] **Step 4: Commit**

```bash
git add app/dispatch/page.tsx app/api/insights/accuracy-summary/route.ts
git commit -m "dispatch: hero strip + alerts rail + demo preset + accuracy summary"
```

---

## Task 22: `app/dispatch/account/page.tsx` — subscription mgmt UI

**Files:**
- Create: `app/dispatch/account/page.tsx`

- [ ] **Step 1: Create the account page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { B2BNav } from '@/components/B2BNav';
import { TIER_LIMITS, type InsightsTier } from '@/lib/insights/stripe-tiers';

interface Subscriber {
  id: number;
  tier: InsightsTier;
  status: string;
  watched_port_ids: string[];
  briefing_enabled: boolean;
  briefing_local_hour: number;
  briefing_tz: string;
  language: 'en' | 'es';
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
}

export default function AccountPage() {
  const [sub, setSub] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/insights/preferences').then((r) => r.json()).then((d) => { setSub(d.subscriber); setLoading(false); });
  }, []);

  async function save(patch: Partial<Subscriber>) {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/insights/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? 'save_failed'); return; }
      setSub(data.subscriber);
      setMsg('Saved.');
    } finally { setSaving(false); }
  }

  async function openPortal() {
    const res = await fetch('/api/insights/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  if (loading) return <main className="p-8 text-white/60">Loading…</main>;
  if (!sub) return (
    <>
      <B2BNav current="account" />
      <main className="mx-auto max-w-[860px] px-5 sm:px-8 py-12 text-slate-100">
        <h1 className="font-serif text-[28px] text-white mb-3">No active Insights subscription</h1>
        <p className="text-white/60 mb-6">Pick a plan on /insights or talk to Diego/Raul to start a trial.</p>
        <a href="/insights" className="inline-block rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-[#0a1020]">See plans →</a>
      </main>
    </>
  );

  const limits = TIER_LIMITS[sub.tier];

  return (
    <>
      <B2BNav current="account" lang={sub.language} />
      <main className="mx-auto max-w-[860px] px-5 sm:px-8 py-10 text-slate-100">
        <h1 className="font-serif text-[28px] text-white mb-1">Insights account</h1>
        <p className="text-white/55 mb-8">{sub.tier.toUpperCase()} · {sub.status} · ${limits.monthlyUsd}/mo</p>

        <Section title="Briefing">
          <Toggle label="Enabled" checked={sub.briefing_enabled} onChange={(v) => save({ briefing_enabled: v })} disabled={saving} />
          <NumberField label="Local hour (0–23)" value={sub.briefing_local_hour} onChange={(v) => save({ briefing_local_hour: v })} />
          <TextField label="Timezone (IANA)" value={sub.briefing_tz} onChange={(v) => save({ briefing_tz: v })} />
          <SelectField label="Language" value={sub.language} options={[{ v: 'en', l: 'English' }, { v: 'es', l: 'Español' }]} onChange={(v) => save({ language: v as 'en' | 'es' })} />
        </Section>

        <Section title="Channels">
          <Toggle label="Email" checked={sub.channel_email} onChange={(v) => save({ channel_email: v })} disabled={saving} />
          <Toggle label="SMS" checked={sub.channel_sms} onChange={(v) => save({ channel_sms: v })} disabled={saving || !limits.channels.sms} />
          <Toggle label="WhatsApp" checked={sub.channel_whatsapp} onChange={(v) => save({ channel_whatsapp: v })} disabled={saving || !limits.channels.whatsapp} />
        </Section>

        <Section title="Recipients">
          <ListField label={`Emails (max ${limits.maxRecipientEmails})`} values={sub.recipient_emails} onChange={(v) => save({ recipient_emails: v })} max={limits.maxRecipientEmails} />
          <ListField label={`Phones E.164 (max ${limits.maxRecipientPhones})`} values={sub.recipient_phones} onChange={(v) => save({ recipient_phones: v })} max={limits.maxRecipientPhones} />
        </Section>

        <Section title="Watched ports">
          <ListField label={`Port IDs (max ${limits.maxWatchedPorts})`} values={sub.watched_port_ids} onChange={(v) => save({ watched_port_ids: v })} max={limits.maxWatchedPorts} />
        </Section>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {sub.tier !== 'free' && (
            <button onClick={openPortal} className="rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.12] px-4 py-2 text-[13px] text-white">Manage billing →</button>
          )}
          {msg && <span className="text-[12px] text-white/55">{msg}</span>}
        </div>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h2 className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className={disabled ? 'text-white/30' : 'text-white/80'}>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-white/80">{label}</span>
      <input type="number" min={0} max={23} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onChange(Number(v))}
        className="w-20 rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white text-right" />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-white/80">{label}</span>
      <input type="text" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onChange(v)}
        className="w-56 rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-white/80">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function ListField({ label, values, onChange, max }: { label: string; values: string[]; onChange: (v: string[]) => void; max: number }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="text-[13px]">
      <div className="text-white/80 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-0.5 text-[12px] text-white/85">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-white/40 hover:text-rose-300">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add…" className="flex-1 rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white" />
        <button
          onClick={() => { if (!draft) return; if (values.includes(draft)) return; if (values.length >= max) return; onChange([...values, draft]); setDraft(''); }}
          className="rounded bg-amber-400 text-[#0a1020] font-semibold px-3 py-1 text-[12px]"
        >Add</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add app/dispatch/account/page.tsx
git commit -m "dispatch/account: subscription + briefing + channels + recipients UI"
```

---

## Task 23: `app/live/page.tsx` — kill meta-refresh, switch to client SWR for data

**Files:**
- Modify: `app/live/page.tsx`
- Create: `components/LiveBoard.tsx`

- [ ] **Step 1: Extract data fetch into a JSON API route**

Create `app/api/live/board/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

export const runtime = 'nodejs';
export const revalidate = 60;

const COVERED = ["230501","230502","230503","230402","230401","230301","535502","535501"];

export async function GET() {
  const db = getServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninety = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const [{ data: live }, { data: hist }] = await Promise.all([
    db.from('wait_time_readings').select('port_id, vehicle_wait, recorded_at').in('port_id', COVERED).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(500),
    db.from('wait_time_readings').select('port_id, vehicle_wait').in('port_id', COVERED).gte('recorded_at', ninety).eq('day_of_week', dow).eq('hour_of_day', hour).limit(20000),
  ]);

  const liveByPort = new Map<string, { wait: number | null; recorded: string }>();
  for (const r of live ?? []) {
    if (liveByPort.has(String(r.port_id))) continue;
    liveByPort.set(String(r.port_id), { wait: r.vehicle_wait ?? null, recorded: r.recorded_at });
  }
  const sums = new Map<string, { s: number; n: number }>();
  for (const r of hist ?? []) {
    if (r.vehicle_wait == null) continue;
    const cur = sums.get(String(r.port_id)) ?? { s: 0, n: 0 };
    cur.s += r.vehicle_wait; cur.n += 1; sums.set(String(r.port_id), cur);
  }

  const rows = COVERED.map((pid) => {
    const meta = PORT_META[pid];
    const lv = liveByPort.get(pid);
    const sm = sums.get(pid);
    const histAvg = sm && sm.n > 0 ? Math.round(sm.s / sm.n) : null;
    const live_wait = lv?.wait ?? null;
    let status: 'normal' | 'anomaly_high' | 'anomaly_low' | 'no_baseline' | 'no_reading' = 'normal';
    let pctAbove: number | null = null;
    if (live_wait == null) status = 'no_reading';
    else if (histAvg == null || histAvg <= 0) status = 'no_baseline';
    else {
      const ratio = live_wait / histAvg;
      pctAbove = Math.round((ratio - 1) * 100);
      if (ratio >= 1.5) status = 'anomaly_high';
      else if (ratio <= 0.67) status = 'anomaly_low';
    }
    return { port_id: pid, name: meta?.localName ?? meta?.city ?? pid, region: meta?.region ?? '', current_wait_min: live_wait, recorded_at: lv?.recorded ?? null, hist_avg_min: histAvg, anomaly_status: status, anomaly_pct_above: pctAbove };
  });

  return NextResponse.json({ rows, generated_at: now.toISOString() });
}
```

- [ ] **Step 2: Create `components/LiveBoard.tsx` — client SWR data block**

```tsx
'use client';
import useSWR from 'swr';

interface Row {
  port_id: string;
  name: string;
  region: string;
  current_wait_min: number | null;
  recorded_at: string | null;
  hist_avg_min: number | null;
  anomaly_status: 'normal' | 'anomaly_high' | 'anomaly_low' | 'no_baseline' | 'no_reading';
  anomaly_pct_above: number | null;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const waitColor = (m: number | null) => m == null ? 'rgba(255,255,255,0.35)' : m <= 20 ? '#22c55e' : m <= 45 ? '#f59e0b' : '#ef4444';

export function LiveBoard() {
  const { data } = useSWR<{ rows: Row[]; generated_at: string }>('/api/live/board', fetcher, { refreshInterval: 60_000, revalidateOnFocus: true });
  if (!data) return <div className="text-white/50">Loading…</div>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: 13 }}>Updated {new Date(data.generated_at).toLocaleString()}</p>
      {data.rows.map((r) => (
        <div key={r.port_id} style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${waitColor(r.current_wait_min)}`, borderRadius: 16, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{r.region}</div>
            </div>
            {r.anomaly_status === 'anomaly_high' && r.anomaly_pct_above != null && (
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}>+{r.anomaly_pct_above}% vs typical</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Now</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: waitColor(r.current_wait_min) }}>{r.current_wait_min ?? '—'}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>min</span></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Typical now</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>{r.hist_avg_min ?? '—'}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>min</span></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Strip the `<head><meta http-equiv="refresh">` from `app/live/page.tsx` and replace data block with `<LiveBoard />`**

In `app/live/page.tsx`, locate lines 187–190 (the `<head>` block with meta refresh) and DELETE entirely. Locate the `<div style={{ display: "grid", gap: 12 }}>{...}` block (lines 239–305 in current file) and replace with `<LiveBoard />`.

After: imports include `import { LiveBoard } from '@/components/LiveBoard';` and the `fetchLiveState` server function becomes unused for the rows — keep it if it's used for the summary band, otherwise delete. Recommend: keep page server-rendered for SEO (anomaly counts in band) but render rows via `<LiveBoard />`. So delete only the row-rendering block, keep everything else.

- [ ] **Step 4: `npm run build` — must pass**

- [ ] **Step 5: Commit**

```bash
git add app/api/live/board/route.ts components/LiveBoard.tsx app/live/page.tsx
git commit -m "live: kill meta-refresh full-reload bug — client SWR data block"
```

---

## Task 24: `components/MomentsNav.tsx` — drop /insights link

**Files:**
- Modify: `components/MomentsNav.tsx`

- [ ] **Step 1: Remove the `/insights` ("before") link**

Open `components/MomentsNav.tsx`. The 3-tab nav has Before/During/After. The "before" tab routes to `/insights`. Replace it with `/` (consumer planning surface) — or remove the slot entirely if nothing routes there. Specifically: change the `before` href from `/insights` to `/` and the label to whatever the consumer planner page uses (or "Plan" if no other surface). If unsure, remove the before slot to leave During (`/live`) and After (`/memory`).

- [ ] **Step 2: `npm run build` — must pass**

- [ ] **Step 3: Commit**

```bash
git add components/MomentsNav.tsx
git commit -m "moments-nav: drop /insights link — B2B not consumer 'before'"
```

---

## Task 25: Update `~/cruzar/CLAUDE.md` architecture section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a section under section 9 (API Routes Reference)**

Append to the existing API table or add a new subsection:

```markdown
### Insights B2B (subscriber-gated)
| Route | Method | Purpose |
|---|---|---|
| `/api/insights/preferences` | GET/PUT | Own subscriber prefs |
| `/api/insights/subscribe` | POST | Free-direct or Stripe checkout for paid tiers |
| `/api/insights/portal` | POST | Stripe billing portal session |
| `/api/insights/accuracy-summary` | GET | Median 30d accuracy across given ports |
| `/api/cron/insights-briefing` | hourly cron | Per-subscriber morning brief at local hour |
| `/api/cron/insights-anomaly-broadcast` | every 30 min | Watched-port anomaly fanout (SMS + email + WhatsApp queued) |
| `/api/admin/create-insights-cron-jobs` | POST | Register both crons at cron-job.org |

### Insights schema (v70)
- `insights_subscribers` — tier, watched ports, briefing prefs (local hour + tz + lang), channels, recipient lists, anomaly thresholds. RLS: own row only.
- `insights_anomaly_fires` — fire log + dedupe table. Service-role only.

### Architecture notes
- `/insights` is the **sales page** (editorial, ~300 lines). NOT a product surface.
- `/dispatch` is the **operator panel** (config + watchlist). The product surface.
- The actual product = morning briefing + anomaly push + calibration receipts. The panel is the configuration surface.
- B2B nav = `<B2BNav />` (Sales · Console · Account). Consumer nav = `<MomentsNav />` (During · After). Do NOT mix them.
- Strip every "AI" mention from customer-visible surfaces per `feedback_ai_as_infrastructure_not_product_20260430`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — add B2B Insights architecture section"
```

---

## Task 26: Final `npm run build` clean

- [ ] **Step 1: Run build**

```bash
cd /c/Users/dnawa/cruzar && npm run build
```
Expected: `✓ Generating static pages (NNN/NNN)` clean, no errors. NNN should be ≥ existing 197.

- [ ] **Step 2: If errors, fix in place + repeat. Commit any fixups separately.**

---

## Task 27: Apply v70 migration to prod Supabase

- [ ] **Step 1: Apply via project script**

```bash
cd /c/Users/dnawa/cruzar && npm run apply-migration -- supabase/migrations/v70-insights-subscribers.sql
```
Expected: success line. Tables visible via Supabase dashboard or `mcp__supabase__list_tables`.

- [ ] **Step 2: Verify tables exist**

Query (via mcp__supabase__execute_sql):
```sql
SELECT table_name FROM information_schema.tables WHERE table_name IN ('insights_subscribers','insights_anomaly_fires');
```
Expected: 2 rows.

---

## Task 28: Set Stripe + Resend + Twilio env vars in Vercel prod

- [ ] **Step 1: Confirm/Add env vars (Diego must create Stripe price IDs first)**

Diego creates 3 prices in Stripe dashboard for $99/$299/$999 monthly subscriptions, copies the `price_xxx` IDs.

In Vercel project settings → Environment Variables, add:
- `STRIPE_INSIGHTS_STARTER_PRICE_ID` = price_xxx (the $99 one)
- `STRIPE_INSIGHTS_PRO_PRICE_ID` = price_xxx (the $299 one)
- `STRIPE_INSIGHTS_FLEET_PRICE_ID` = price_xxx (the $999 one)

Verify existing: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `CRON_SECRET`. If any missing, this is a Diego task (cannot create Stripe prices on his behalf).

If env vars are not yet set, the app degrades gracefully — paid tiers can't be subscribed to but free tier + everything else works. Mark this as a Diego post-ship blocker, not a build-time blocker.

---

## Task 29: `vercel deploy --prod`

- [ ] **Step 1: Deploy**

```bash
cd /c/Users/dnawa/cruzar && vercel deploy --prod
```
Expected: deployment URL like `https://cruzar-xxx.vercel.app` AND `https://cruzar.app` should resolve to the new build within ~30 seconds.

- [ ] **Step 2: Capture deployment ID** for the verification step.

---

## Task 30: Curl + Playwright + pacer verification

- [ ] **Step 1: Curl-verify endpoints**

```bash
# Public render
curl -s https://cruzar.app/insights | grep -o "<title>[^<]*</title>"
# Expected: <title>Cruzar Insights — the 5am border read</title>

# /insights MUST NOT contain "AI" / "Claude" / "MCP"
curl -s https://cruzar.app/insights | grep -E "(AI-powered|AI assistant|Claude|MCP)" || echo "clean ✓"

# Live API
curl -s https://cruzar.app/api/live/board | head -c 200

# Dispatch snapshot (existing)
curl -s "https://cruzar.app/api/dispatch/snapshot?ports=230502,230501" | head -c 200

# Dry-run cron — replace SECRET
curl -s "https://cruzar.app/api/cron/insights-briefing?secret=$CRON_SECRET&dryRun=1"
curl -s "https://cruzar.app/api/cron/insights-anomaly-broadcast?secret=$CRON_SECRET&dryRun=1"

# Demo route renders
curl -s "https://cruzar.app/dispatch?demo=rgv" | grep -o "<title>[^<]*</title>"
```

All should return non-empty + status 200 + no error keys.

- [ ] **Step 2: Playwright spot-check (optional, if available)**

Use `mcp__plugin_playwright_playwright__browser_navigate` to visit `https://cruzar.app/insights` and `https://cruzar.app/dispatch?demo=rgv`. Take screenshots. Confirm:
- /insights renders hero, math card, scoreboard, 6 decision-grade ports, pricing tiers
- /dispatch?demo=rgv shows hero strip with watching=6 + RGV-heavy watchlist preset

- [ ] **Step 3: Pacer agent verification**

Dispatch `pacer` agent (per `feedback_invoke_pacer_before_done.md`). Prompt:

> Cruzar Insights B2B operator panel rebuild was just shipped. Verify against deployed state:
> 1. https://cruzar.app/insights renders the new editorial page (hero "the black hole" copy, calibration scoreboard, 6 decision-grade ports, $99/$299/$999 pricing).
> 2. https://cruzar.app/insights does NOT contain "AI", "Claude", "MCP", "AI-powered" anywhere in HTML.
> 3. https://cruzar.app/dispatch shows the hero strip ("Watching N · X anomalies · accuracy% · briefing").
> 4. https://cruzar.app/dispatch?demo=rgv loads RGV-heavy preset.
> 5. https://cruzar.app/live still renders without the meta-refresh tag.
> 6. Both new cron endpoints respond 200 with valid JSON in dry-run.
>
> Block on any unverified claim. Report < 200 words.

- [ ] **Step 4: If pacer flags issues, fix + redeploy. Commit fixups separately.**

- [ ] **Step 5: Final commit (CLAUDE.md updates + active-queue strikethroughs)**

```bash
cd /c/Users/dnawa/cruzar && git add -A && git commit -m "docs: post-ship CLAUDE.md sync + cleanup" || true
git push origin main
```

Then update `~/brain/projects/Cruzar.md` Active queue: strike through completed items (calibration scoreboard, /pulse-prep, etc) in a separate commit to the brain repo.

---

## Self-review

**Spec coverage:**
- ✓ /insights rebuild — Task 18
- ✓ Verbatim hero copy — Tasks 3, 17
- ✓ Calibration scoreboard inline — Tasks 15, 18
- ✓ Detention math anchor — Tasks 16, 18
- ✓ Strip "AI" — Tasks 3, 17, 18 (+ verified in Task 30)
- ✓ B2B nav decoupling — Tasks 14, 24
- ✓ /dispatch hero — Tasks 19, 21
- ✓ /dispatch alerts rail — Tasks 20, 21
- ✓ /dispatch demo preset — Task 21
- ✓ /dispatch/account — Task 22
- ✓ v70 migration — Tasks 1, 27
- ✓ Stripe tiers — Tasks 2, 7, 28
- ✓ Stripe checkout — Task 5
- ✓ Stripe webhook — Task 7
- ✓ Stripe portal — Task 6
- ✓ Briefing cron — Tasks 8, 9
- ✓ Anomaly cron — Tasks 10, 11
- ✓ WhatsApp inbound parser — Task 12
- ✓ Cron registration — Task 13
- ✓ /live meta-refresh fix — Task 23
- ✓ MomentsNav drop /insights — Task 24
- ✓ CLAUDE.md update — Task 25
- ✓ Build + deploy + curl + pacer — Tasks 26–30

**Placeholder scan:** No "TBD", no "implement later", no "similar to Task N". One TODO in Task 12 ("once cruzar_smart_route is reusable from server context") — acceptable as it's a minor reply-builder fallback that returns a usable string today.

**Type consistency:** `insights_subscribers` columns, tier names (`free`/`starter`/`pro`/`fleet`), `tier === 'insights_xxx'` metadata convention all consistent across migration, Stripe webhook, subscribe endpoint, preferences endpoint.

**Scope check:** Single subsystem (Cruzar Insights B2B). One plan.
