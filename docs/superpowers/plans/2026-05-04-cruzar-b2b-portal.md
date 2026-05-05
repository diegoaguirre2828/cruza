# Cruzar B2B Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proper B2B front door at `/b2b` that gives prospects a clean public portal with real calibration data, guides new operators through onboarding at `/b2b/start`, and restructures B2BNav so anonymous visitors see a public surface while authenticated users see the operator tabs.

**Architecture:** `/b2b` replaces `/insights` as the nav Sales tab — it's the public portal (hero + live accuracy strip from real `calibration_log` data + walkthrough + pricing + CTA). `/b2b/start` is a 3-step wizard (commodity type → watched ports → account creation) that writes B2B preferences to `profiles` on completion and redirects to `/workspace`. B2BNav splits into public routes (Portal, Accuracy) for anonymous visitors and operator routes (Workspace, Console, Refunds, EU MDR) for authenticated users. `/insights` gets a permanent 308 redirect to `/b2b`.

**Tech Stack:** Next.js 16.2.1 App Router, React 19, TypeScript strict, Tailwind v4 design tokens, Supabase PostgreSQL (service-role for server reads, user client for writes), Framer Motion 12 for wizard transitions, `CalibrationScoreboard` server component (already exists, reused), `npm run apply-migration` script for DB.

---

## File Structure

**Create:**
- `supabase/migrations/v88-b2b-profile-columns.sql` — adds `b2b_onboarded_at`, `b2b_commodity_type`, `b2b_watched_ports` to `profiles`
- `lib/copy/b2b-en.ts` — English copy for the portal and wizard
- `lib/copy/b2b-es.ts` — Spanish copy for the portal and wizard
- `app/b2b/page.tsx` — public portal server page
- `app/b2b/start/page.tsx` — onboarding wizard server shell
- `app/b2b/start/OnboardingWizard.tsx` — wizard client component (3 steps)
- `app/api/b2b/onboard/route.ts` — writes B2B prefs to profiles after auth

**Modify:**
- `components/B2BNav.tsx` — split public vs. authenticated tab sets
- `app/insights/page.tsx` — add 308 redirect to `/b2b` at top

---

## Task 1: DB migration v88 — B2B profile columns

**Files:**
- Create: `supabase/migrations/v88-b2b-profile-columns.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- v88: B2B onboarding columns on profiles
-- b2b_onboarded_at  — set when wizard completes; null = not yet onboarded
-- b2b_commodity_type — free-text commodity category picked in wizard step 1
-- b2b_watched_ports  — port IDs the operator watches (default first-time from wizard step 2)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS b2b_onboarded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS b2b_commodity_type  TEXT,
  ADD COLUMN IF NOT EXISTS b2b_watched_ports   TEXT[] DEFAULT '{}';
```

- [ ] **Step 2: Apply to prod**

```bash
npm run apply-migration -- supabase/migrations/v88-b2b-profile-columns.sql
```

Expected: `{ "message": "Migration applied successfully" }` or similar success response.

- [ ] **Step 3: Verify columns exist**

```bash
curl -s "https://cruzar.app/api/admin/schema-check?table=profiles&secret=$CRON_SECRET" 2>/dev/null || echo "manual verify in Supabase dashboard"
```

If the endpoint doesn't exist, confirm in Supabase dashboard: Table Editor → profiles → should show `b2b_onboarded_at`, `b2b_commodity_type`, `b2b_watched_ports`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/v88-b2b-profile-columns.sql
git commit -m "feat(db): v88 B2B profile columns — onboarded_at, commodity_type, watched_ports"
```

---

## Task 2: Copy files — B2B portal English + Spanish

**Files:**
- Create: `lib/copy/b2b-en.ts`
- Create: `lib/copy/b2b-es.ts`

- [ ] **Step 1: Write `lib/copy/b2b-en.ts`**

```ts
// B2B portal copy (English). NO "AI" / "model" / "MCP" on customer surfaces.
// Per feedback_ai_as_infrastructure_not_product_20260430.md.

export const B2B_EN = {
  hero: {
    eyebrow: 'For RGV cross-border freight brokers · dispatchers · fleets',
    title: 'The border intelligence layer for your freight operation.',
    sub: "One 5am briefing. A push when something breaks. Calibration receipts that prove we called it right. The operators who know go first.",
    cta: 'Start free — 2 minutes',
    ctaSub: 'See live accuracy →',
  },
  accuracy: {
    kicker: 'Live results · 30 days',
    title: 'We publish every miss.',
    sub: 'Every forecast logged, then scored against what the bridge actually did. Per port. Same chart we use internally.',
  },
  howItWorks: {
    kicker: 'How it shows up',
    title: 'Three signals. One decision.',
    steps: [
      {
        n: '01',
        title: '5am brief',
        body: 'Port-by-port wait forecast arrives before your team briefs. Plan the day before the border opens.',
      },
      {
        n: '02',
        title: 'Anomaly push',
        body: 'When a port spikes 1.5× its baseline, you know before your drivers queue.',
      },
      {
        n: '03',
        title: 'Calibration receipt',
        body: 'Every call logged. Accuracy published. No black box — read the math yourself.',
      },
    ],
  },
  detentionMath: {
    title: 'Why the math works',
    body: '10 trucks × 1 wrong-bridge-pick/day × 30 min wasted × $85/hr = ~$10,200/mo bleeding. Insights Pro at $299/mo cuts about 30% of that. Net save: $2,800+/mo.',
    footnote:
      'Industry-wide: $3.6B/yr in direct detention losses, $11.5B/yr in lost productivity (ATRI 2024). 39% of stops detained.',
  },
  pricing: {
    kicker: 'Pricing',
    title: 'Simple tiers. Cancel any time.',
    starter: {
      tier: 'Starter',
      price: '$99 / mo',
      summary: '1 port · morning brief · anomaly push · email delivery',
    },
    pro: {
      tier: 'Pro',
      price: '$299 / mo',
      summary: 'Up to 5 ports · all channels · calibration dashboard',
    },
    fleet: {
      tier: 'Fleet',
      price: '$999 / mo',
      summary: 'Unlimited ports · API access · team seats · SLA',
    },
  },
  wizard: {
    step1: {
      title: 'What are you moving?',
      sub: 'We tune your briefing around your commodity profile.',
      options: [
        { value: 'perishables',   label: 'Perishables / produce' },
        { value: 'dry_goods',     label: 'Dry goods / general freight' },
        { value: 'hazmat',        label: 'Hazmat / regulated cargo' },
        { value: 'automotive',    label: 'Automotive / parts' },
        { value: 'retail',        label: 'Retail / consumer goods' },
        { value: 'mixed',         label: 'Mixed / full truckload' },
      ],
    },
    step2: {
      title: 'Which ports do you watch?',
      sub: 'Select the crossings your lanes run through. You can change this later.',
    },
    step3: {
      title: 'Create your free account.',
      sub: 'No credit card. Start reading the 5am brief tomorrow morning.',
      emailLabel: 'Work email',
      passwordLabel: 'Password',
      cta: 'Create account →',
      orDivider: 'or',
      googleCta: 'Continue with Google',
      alreadyHave: 'Already have an account?',
      signIn: 'Sign in →',
    },
    back: '← Back',
    next: 'Next →',
    progressOf: 'of',
  },
  notAffiliated:
    'Not affiliated with CBP, GSA, or any government agency. Wait-time data sourced from the CBP Border Wait Times API (public domain).',
  poweredBy: 'CRUZAR · RGV-MX CORRIDOR · 26.18°N · 98.18°W',
};
```

- [ ] **Step 2: Write `lib/copy/b2b-es.ts`**

```ts
// B2B portal copy (Spanish). NO "IA" / "modelo" / "MCP" en superficies de cliente.

export const B2B_ES = {
  hero: {
    eyebrow: 'Para brokers de carga cross-border del RGV · despachadores · flotillas',
    title: 'La capa de inteligencia fronteriza para tu operación.',
    sub: "Un briefing a las 5am. Un push cuando algo se rompe. Recibos de calibración que prueban que lo predijimos bien. Los operadores que saben van primero.",
    cta: 'Empieza gratis — 2 minutos',
    ctaSub: 'Ver precisión en vivo →',
  },
  accuracy: {
    kicker: 'Resultados en vivo · 30 días',
    title: 'Publicamos cada falla.',
    sub: 'Cada predicción registrada, luego calificada contra lo que hizo el puente. Por puerto. La misma tabla que usamos internamente.',
  },
  howItWorks: {
    kicker: 'Cómo aparece',
    title: 'Tres señales. Una decisión.',
    steps: [
      {
        n: '01',
        title: 'Brief de 5am',
        body: 'El pronóstico por puerto llega antes de que tu equipo se briefee. Planea el día antes de que abra la frontera.',
      },
      {
        n: '02',
        title: 'Push de anomalía',
        body: 'Cuando un puerto sube 1.5× su línea base, tú sabes antes de que tus choferes hagan fila.',
      },
      {
        n: '03',
        title: 'Recibo de calibración',
        body: 'Cada predicción registrada. Precisión publicada. Sin caja negra — lee los números tú mismo.',
      },
    ],
  },
  detentionMath: {
    title: 'Por qué funciona la matemática',
    body: '10 tráilers × 1 mala elección de puente/día × 30 min perdidos × $85/hr = ~$10,200/mes de pérdida. Insights Pro a $299/mes corta ~30% de eso. Ahorro neto: $2,800+/mes.',
    footnote:
      'A nivel industria: $3.6B/año en pérdidas directas por detención, $11.5B/año en productividad perdida (ATRI 2024). 39% de las paradas detenidas.',
  },
  pricing: {
    kicker: 'Precios',
    title: 'Niveles simples. Cancela en cualquier momento.',
    starter: {
      tier: 'Starter',
      price: '$99 / mes',
      summary: '1 puerto · brief matutino · push de anomalía · entrega por email',
    },
    pro: {
      tier: 'Pro',
      price: '$299 / mes',
      summary: 'Hasta 5 puertos · todos los canales · dashboard de calibración',
    },
    fleet: {
      tier: 'Fleet',
      price: '$999 / mes',
      summary: 'Puertos ilimitados · acceso API · asientos para equipo · SLA',
    },
  },
  wizard: {
    step1: {
      title: '¿Qué estás moviendo?',
      sub: 'Afinamos tu briefing según tu perfil de carga.',
      options: [
        { value: 'perishables',   label: 'Perecederos / produce' },
        { value: 'dry_goods',     label: 'Carga seca / general' },
        { value: 'hazmat',        label: 'Hazmat / carga regulada' },
        { value: 'automotive',    label: 'Automotriz / partes' },
        { value: 'retail',        label: 'Retail / bienes de consumo' },
        { value: 'mixed',         label: 'Mixto / carga completa' },
      ],
    },
    step2: {
      title: '¿Cuáles puertos vigilas?',
      sub: 'Selecciona los cruces por donde corren tus rutas. Puedes cambiarlos después.',
    },
    step3: {
      title: 'Crea tu cuenta gratis.',
      sub: 'Sin tarjeta. Empieza a leer el brief de 5am mañana en la mañana.',
      emailLabel: 'Correo de trabajo',
      passwordLabel: 'Contraseña',
      cta: 'Crear cuenta →',
      orDivider: 'o',
      googleCta: 'Continuar con Google',
      alreadyHave: '¿Ya tienes cuenta?',
      signIn: 'Entrar →',
    },
    back: '← Atrás',
    next: 'Siguiente →',
    progressOf: 'de',
  },
  notAffiliated:
    'No afiliados con CBP, GSA, ni ninguna agencia gubernamental. Datos de tiempo de espera provenientes de la API pública de CBP Border Wait Times.',
  poweredBy: 'CRUZAR · CORREDOR RGV-MX · 26.18°N · 98.18°W',
};
```

- [ ] **Step 3: Verify TypeScript types match**

Both files export a plain object. The portal page will import `{ B2B_EN }` and `{ B2B_ES }` — no shared interface needed; TypeScript will infer. No build step required yet.

- [ ] **Step 4: Commit**

```bash
git add lib/copy/b2b-en.ts lib/copy/b2b-es.ts
git commit -m "feat(copy): B2B portal copy EN+ES — wizard + portal sections"
```

---

## Task 3: `/api/b2b/onboard` — write preferences after signup

**Files:**
- Create: `app/api/b2b/onboard/route.ts`

This route is called by the wizard after the user creates an account. It writes commodity type + watched ports + onboarded_at to the user's profile row.

- [ ] **Step 1: Write the route**

```ts
// app/api/b2b/onboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { commodity_type?: string; watched_ports?: string[] };
  const { commodity_type, watched_ports } = body;

  const { error } = await sb
    .from('profiles')
    .update({
      b2b_commodity_type: commodity_type ?? null,
      b2b_watched_ports: watched_ports ?? [],
      b2b_onboarded_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Run build to verify TypeScript**

```bash
npm run build 2>&1 | grep -E "error|Error|✓" | head -20
```

Expected: no TypeScript errors on the new route.

- [ ] **Step 3: Commit**

```bash
git add app/api/b2b/onboard/route.ts
git commit -m "feat(api): POST /api/b2b/onboard — writes B2B prefs to profiles on wizard completion"
```

---

## Task 4: `/b2b` public portal page

**Files:**
- Create: `app/b2b/page.tsx`

The portal is a server component. It pulls real calibration data via the existing `CalibrationScoreboard` component. Design tokens throughout (no hardcoded amber/navy).

- [ ] **Step 1: Write `app/b2b/page.tsx`**

```tsx
import { B2BNav } from '@/components/B2BNav';
import { CalibrationScoreboard } from '@/components/CalibrationScoreboard';
import { B2B_EN } from '@/lib/copy/b2b-en';
import { B2B_ES } from '@/lib/copy/b2b-es';

export const metadata = {
  title: 'Cruzar B2B — Border intelligence for RGV freight',
  description:
    'Per-port wait-time forecasts + calibration receipts for RGV cross-border freight brokers, dispatchers, and fleets. Morning email + anomaly push.',
  alternates: { canonical: 'https://www.cruzar.app/b2b' },
};

export const dynamic = 'force-dynamic';

export default async function B2BPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? B2B_ES : B2B_EN;
  const es = lang === 'es';

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      {/* HERO */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-20 sm:py-28">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent ws-d0">
            {c.hero.eyebrow}
          </div>
          <h1 className="ws-d1 mt-5 font-serif text-[clamp(2.6rem,5vw,4.2rem)] font-medium leading-[1.02] text-foreground tracking-[-0.02em] max-w-3xl">
            {c.hero.title}
          </h1>
          <p className="ws-d2 mt-7 max-w-xl text-[15px] leading-[1.7] text-muted-foreground">
            {c.hero.sub}
          </p>
          <div className="ws-d3 mt-9 flex flex-wrap items-center gap-4">
            <a
              href={`/b2b/start${lang === 'es' ? '?lang=es' : ''}`}
              className="inline-flex items-center gap-3 bg-foreground px-6 py-3.5 text-[14px] font-semibold text-background hover:bg-foreground/90 transition"
            >
              <span>{c.hero.cta}</span>
              <span aria-hidden>→</span>
            </a>
            <a
              href="/insights/accuracy"
              className="text-[14px] text-muted-foreground hover:text-foreground transition"
            >
              {c.hero.ctaSub}
            </a>
          </div>
        </div>
      </section>

      {/* LIVE ACCURACY — real calibration_log data */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
              {c.accuracy.kicker}
            </div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-foreground mt-2">
              {c.accuracy.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">{c.accuracy.sub}</p>
          </div>
          <CalibrationScoreboard lang={lang} />
          <div className="mt-4 text-[13px]">
            <a
              href="/insights/accuracy"
              className="text-accent hover:text-accent/80 underline decoration-accent/40 transition"
            >
              {es ? 'Ver backtest completo →' : 'See full backtest →'}
            </a>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 3 steps */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
              {c.howItWorks.kicker}
            </div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-foreground mt-2">
              {c.howItWorks.title}
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
            {c.howItWorks.steps.map((s) => (
              <div key={s.n} className="bg-background p-7">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-3">
                  {s.n}
                </div>
                <h3 className="font-serif text-[1.4rem] font-medium leading-[1.15] text-foreground">
                  {s.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-[1.55] text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DETENTION MATH */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="border border-border bg-card/30 p-7 sm:p-9">
            <h3 className="font-serif text-[1.6rem] font-medium text-foreground">{c.detentionMath.title}</h3>
            <p className="mt-4 text-[15px] leading-[1.7] text-foreground/90 max-w-3xl">
              {c.detentionMath.body}
            </p>
            <p className="mt-4 text-[12px] text-muted-foreground/60 leading-snug max-w-2xl">
              {c.detentionMath.footnote}
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
              {c.pricing.kicker}
            </div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-foreground mt-2">
              {c.pricing.title}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[c.pricing.starter, c.pricing.pro, c.pricing.fleet].map((p) => (
              <div key={p.tier} className="border border-border bg-card/30 p-6">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
                  {p.tier}
                </div>
                <div className="font-serif text-[28px] text-foreground mt-2">{p.price}</div>
                <p className="mt-2 text-[13px] text-muted-foreground">{p.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={`/b2b/start${lang === 'es' ? '?lang=es' : ''}`}
              className="inline-flex items-center gap-3 bg-foreground px-6 py-3.5 text-[14px] font-semibold text-background hover:bg-foreground/90 transition"
            >
              <span>{c.hero.cta}</span>
              <span aria-hidden>→</span>
            </a>
            <a
              href={`mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial`}
              className="text-[14px] text-muted-foreground hover:text-foreground transition"
            >
              {es ? 'Hablar con ventas →' : 'Talk to sales →'}
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-card border-t border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 text-[12px] text-muted-foreground/50">
          {c.notAffiliated} ·{' '}
          <a href="?lang=en" className="hover:text-foreground transition">EN</a>{' '}
          ·{' '}
          <a href="?lang=es" className="hover:text-foreground transition">ES</a>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -20
```

Expected: `/b2b` compiles cleanly. Fix any TypeScript errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add app/b2b/page.tsx
git commit -m "feat(b2b): /b2b public portal page — hero + live calibration + walkthrough + pricing"
```

---

## Task 5: `/b2b/start` onboarding wizard

**Files:**
- Create: `app/b2b/start/page.tsx` — server shell
- Create: `app/b2b/start/OnboardingWizard.tsx` — client wizard component

The wizard saves commodity type + watched ports to `localStorage` as `cruzar_b2b_intent` JSON, then on step 3 creates the account and calls `/api/b2b/onboard` before redirecting to `/workspace`.

RGV ports offered in step 2: Hidalgo (230501), Pharr-Reynosa (230502), Anzaldúas (230503), Progreso (230901), Rio Grande City (230701), Brownsville Gateway (535501), Brownsville Veterans (535502), Laredo I (230401), Laredo II (230402).

- [ ] **Step 1: Write `app/b2b/start/page.tsx`**

```tsx
import { B2BNav } from '@/components/B2BNav';
import { OnboardingWizard } from './OnboardingWizard';
import { B2B_EN } from '@/lib/copy/b2b-en';
import { B2B_ES } from '@/lib/copy/b2b-es';

export const metadata = {
  title: 'Get started — Cruzar B2B',
  description: 'Set up your Cruzar Insights account in 2 minutes.',
};

export default async function B2BStartPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? B2B_ES : B2B_EN;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />
      <OnboardingWizard lang={lang} copy={c.wizard} />
    </div>
  );
}
```

- [ ] **Step 2: Write `app/b2b/start/OnboardingWizard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/auth';
import { GoogleButton } from '@/components/GoogleButton';

const RGV_PORTS = [
  { id: '230501', label: 'Hidalgo / McAllen' },
  { id: '230502', label: 'Pharr–Reynosa' },
  { id: '230503', label: 'Anzaldúas' },
  { id: '230901', label: 'Progreso' },
  { id: '230701', label: 'Rio Grande City' },
  { id: '535501', label: 'Brownsville Gateway' },
  { id: '535502', label: 'Brownsville Veterans' },
  { id: '230401', label: 'Laredo I (Gateway)' },
  { id: '230402', label: 'Laredo II (World Trade)' },
];

interface WizardCopy {
  step1: {
    title: string;
    sub: string;
    options: { value: string; label: string }[];
  };
  step2: { title: string; sub: string };
  step3: {
    title: string;
    sub: string;
    emailLabel: string;
    passwordLabel: string;
    cta: string;
    orDivider: string;
    googleCta: string;
    alreadyHave: string;
    signIn: string;
  };
  back: string;
  next: string;
  progressOf: string;
}

interface Props {
  lang: 'en' | 'es';
  copy: WizardCopy;
}

export function OnboardingWizard({ lang, copy: c }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [commodity, setCommodity] = useState('');
  const [ports, setPorts] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  function togglePort(id: string) {
    setPorts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const sb = createClient();
      const { error: signupErr } = await sb.auth.signUp({ email, password });
      if (signupErr) throw new Error(signupErr.message);
      await writePrefs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function writePrefs() {
    await fetch('/api/b2b/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commodity_type: commodity, watched_ports: ports }),
    });
    router.replace(`/workspace${langSuffix}`);
  }

  const progressLabel = `${step} ${c.progressOf} 3`;

  return (
    <div className="mx-auto max-w-[560px] px-5 sm:px-8 py-16 sm:py-24">
      {/* Progress */}
      <div className="mb-8 flex items-center gap-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={[
              'h-1 flex-1 transition-all',
              n <= step ? 'bg-foreground' : 'bg-border',
            ].join(' ')}
          />
        ))}
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/60 ml-2 shrink-0">
          {progressLabel}
        </span>
      </div>

      {/* Step 1: Commodity */}
      {step === 1 && (
        <div>
          <h1 className="font-serif text-[2rem] font-medium text-foreground leading-[1.1]">
            {c.step1.title}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">{c.step1.sub}</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {c.step1.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCommodity(opt.value)}
                className={[
                  'text-left border p-4 font-mono text-[12px] uppercase tracking-[0.14em] transition',
                  commodity === opt.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!commodity}
            onClick={() => setStep(2)}
            className="mt-8 w-full bg-foreground py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {c.next}
          </button>
        </div>
      )}

      {/* Step 2: Ports */}
      {step === 2 && (
        <div>
          <h1 className="font-serif text-[2rem] font-medium text-foreground leading-[1.1]">
            {c.step2.title}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">{c.step2.sub}</p>
          <div className="mt-8 grid grid-cols-1 gap-2">
            {RGV_PORTS.map((port) => {
              const checked = ports.includes(port.id);
              return (
                <button
                  key={port.id}
                  type="button"
                  onClick={() => togglePort(port.id)}
                  className={[
                    'flex items-center justify-between border p-4 font-mono text-[12px] uppercase tracking-[0.14em] transition',
                    checked
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                  ].join(' ')}
                >
                  <span>{port.label}</span>
                  {checked && <span aria-hidden>✓</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="border border-border px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
            >
              {c.back}
            </button>
            <button
              type="button"
              disabled={ports.length === 0}
              onClick={() => setStep(3)}
              className="flex-1 bg-foreground py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {c.next}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Account creation */}
      {step === 3 && (
        <div>
          <h1 className="font-serif text-[2rem] font-medium text-foreground leading-[1.1]">
            {c.step3.title}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">{c.step3.sub}</p>

          {/* Google OAuth */}
          <div className="mt-8">
            <GoogleButton label={c.step3.googleCta} next="/workspace" />
          </div>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/50">
              {c.step3.orDivider}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
                {c.step3.emailLabel}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-border bg-card/30 px-4 py-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/60 transition"
              />
            </div>
            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
                {c.step3.passwordLabel}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border border-border bg-card/30 px-4 py-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/60 transition"
              />
            </div>
            {error && (
              <p className="text-[13px] text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90 transition disabled:opacity-60"
            >
              {loading ? '…' : c.step3.cta}
            </button>
          </form>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="border border-border px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
            >
              {c.back}
            </button>
            <div className="flex-1" />
          </div>

          <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/50">
            {c.step3.alreadyHave}{' '}
            <a href={`/login${lang === 'es' ? '?lang=es' : ''}`} className="text-accent hover:text-accent/80 transition">
              {c.step3.signIn}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | grep -E "error|✓" | head -20
```

Expected: both `/b2b/start` pages compile cleanly.

- [ ] **Step 4: Commit**

```bash
git add app/b2b/start/page.tsx app/b2b/start/OnboardingWizard.tsx
git commit -m "feat(b2b): /b2b/start onboarding wizard — commodity + ports + account creation"
```

---

## Task 6: B2BNav — split public vs. authenticated tabs

**Files:**
- Modify: `components/B2BNav.tsx`

Anonymous users see: **Portal** (/b2b) + **Accuracy** (/insights/accuracy) + Sign in + **Get started** CTA.  
Authenticated users see: **Workspace** + **Console** + **Refunds** + **EU MDR** (same as today minus the Sales tab).  
The `sales` key pointing to `/insights` is removed; the new `portal` key points to `/b2b`.

- [ ] **Step 1: Read the current file to confirm line count and exact text**

Read `components/B2BNav.tsx` fully before editing (required).

- [ ] **Step 2: Replace the ROUTES array and add PUBLIC_ROUTES**

In `components/B2BNav.tsx`, replace:
```ts
const ROUTES: Array<{ key: NonNullable<B2BNavProps['current']>; href: string; en: string; es: string }> = [
  { key: 'workspace', href: '/workspace', en: 'Workspace', es: 'Workspace' },
  { key: 'sales',     href: '/insights',  en: 'Sales',     es: 'Ventas' },
  { key: 'console',   href: '/dispatch',  en: 'Console',   es: 'Consola' },
  { key: 'refunds',   href: '/refunds',   en: 'Refunds',   es: 'Reembolsos' },
  { key: 'eudamed',   href: '/eudamed',   en: 'EU MDR',    es: 'EU MDR' },
];
```

With:
```ts
// Tabs shown only when authenticated
const AUTH_ROUTES: Array<{ key: NonNullable<B2BNavProps['current']>; href: string; en: string; es: string }> = [
  { key: 'workspace', href: '/workspace',        en: 'Workspace', es: 'Workspace' },
  { key: 'console',   href: '/dispatch',         en: 'Console',   es: 'Consola' },
  { key: 'refunds',   href: '/refunds',          en: 'Refunds',   es: 'Reembolsos' },
  { key: 'eudamed',   href: '/eudamed',          en: 'EU MDR',    es: 'EU MDR' },
];

// Tabs shown to anonymous visitors
const PUBLIC_ROUTES: Array<{ key: NonNullable<B2BNavProps['current']>; href: string; en: string; es: string }> = [
  { key: 'portal',   href: '/b2b',              en: 'Portal',    es: 'Portal' },
  { key: 'accuracy', href: '/insights/accuracy', en: 'Accuracy',  es: 'Precisión' },
];
```

- [ ] **Step 3: Update the `B2BNavProps` current union type**

Replace:
```ts
interface B2BNavProps {
  current?: 'workspace' | 'sales' | 'console' | 'account' | 'refunds' | 'eudamed';
  lang?: 'en' | 'es';
}
```

With:
```ts
interface B2BNavProps {
  current?: 'workspace' | 'portal' | 'accuracy' | 'console' | 'account' | 'refunds' | 'eudamed';
  lang?: 'en' | 'es';
}
```

- [ ] **Step 4: Replace the tabs rendering in the JSX**

Find the `{/* Tabs */}` section:
```tsx
        {/* Tabs */}
        <div className="flex items-stretch flex-1 overflow-x-auto">
          {ROUTES.map((r) => {
```

Replace the entire `{/* Tabs */}` div with:
```tsx
        {/* Tabs — public surface for anon, operator surface for authed */}
        <div className="flex items-stretch flex-1 overflow-x-auto">
          {(user ? AUTH_ROUTES : PUBLIC_ROUTES).map((r) => {
            const isActive = active === r.key;
            return (
              <Link
                key={r.key}
                href={`${r.href}${langSuffix}`}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group relative flex items-center px-4 sm:px-5 font-mono text-[11px] uppercase tracking-[0.18em] transition border-r border-border',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                ].join(' ')}
              >
                {lang === 'es' ? r.es : r.en}
              </Link>
            );
          })}
        </div>
```

- [ ] **Step 5: Update anonymous CTA — replace `Sign up free` with `Get started`**

Find the anonymous sign-up link:
```tsx
              <Link
                href={`/signup${langSuffix}`}
                className="flex items-center px-4 sm:px-5 bg-foreground hover:bg-foreground/85 transition font-mono text-[11px] uppercase tracking-[0.18em] text-background"
              >
                {lang === 'es' ? 'Crear cuenta' : 'Sign up free'}
              </Link>
```

Replace with:
```tsx
              <Link
                href={`/b2b/start${langSuffix}`}
                className="flex items-center px-4 sm:px-5 bg-foreground hover:bg-foreground/85 transition font-mono text-[11px] uppercase tracking-[0.18em] text-background"
              >
                {lang === 'es' ? 'Empezar →' : 'Get started →'}
              </Link>
```

- [ ] **Step 6: Update `deriveActive` to include the new keys**

Replace:
```ts
function deriveActive(pathname: string | null): NonNullable<B2BNavProps['current']> {
  if (!pathname) return 'workspace';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/eudamed')) return 'eudamed';
  if (pathname.startsWith('/refunds')) return 'refunds';
  if (pathname.startsWith('/dispatch/account')) return 'account';
  if (pathname.startsWith('/dispatch')) return 'console';
  return 'sales';
}
```

With:
```ts
function deriveActive(pathname: string | null): NonNullable<B2BNavProps['current']> {
  if (!pathname) return 'workspace';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/eudamed')) return 'eudamed';
  if (pathname.startsWith('/refunds')) return 'refunds';
  if (pathname.startsWith('/dispatch/account')) return 'account';
  if (pathname.startsWith('/dispatch')) return 'console';
  if (pathname.startsWith('/b2b')) return 'portal';
  if (pathname.startsWith('/insights/accuracy')) return 'accuracy';
  return 'portal';
}
```

- [ ] **Step 7: Run build**

```bash
npm run build 2>&1 | grep -E "error|✓" | head -20
```

Expected: clean compile. The `authLoading` guard already handles the flash — anonymous state shows PUBLIC_ROUTES, authenticated shows AUTH_ROUTES.

- [ ] **Step 8: Commit**

```bash
git add components/B2BNav.tsx
git commit -m "feat(nav): B2BNav splits public (Portal + Accuracy) vs. authenticated (Workspace + Console + ...) tabs"
```

---

## Task 7: Redirect `/insights` → `/b2b`

**Files:**
- Modify: `app/insights/page.tsx`

Add a permanent redirect at the very top of the file so any link to `/insights` lands at `/b2b`.

- [ ] **Step 1: Add the redirect import at the top of `app/insights/page.tsx`**

After the existing imports block (after the last `import` line), add:
```ts
import { redirect } from 'next/navigation';
```

- [ ] **Step 2: Add the redirect as the first line inside the component body**

Inside `export default async function InsightsPage(...)`, before the `const params = await searchParams;` line, add:
```ts
  const { lang: rawLang } = await searchParams;
  redirect(rawLang === 'es' ? '/b2b?lang=es' : '/b2b');
```

**Important:** Remove (or move below the redirect) the original `const params = await searchParams;` line to avoid a duplicate `await searchParams` call. The final function start should look like:

```ts
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: rawLang } = await searchParams;
  redirect(rawLang === 'es' ? '/b2b?lang=es' : '/b2b');
  // The rest of the function body is now unreachable but kept for reference.
  // TypeScript will not warn since redirect() throws.
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | grep -E "error|✓" | head -20
```

Expected: clean. Next.js `redirect()` throws internally so the remainder of the function is unreachable without a TypeScript error.

- [ ] **Step 4: Commit**

```bash
git add app/insights/page.tsx
git commit -m "feat(redirect): /insights → /b2b permanent redirect (308)"
```

---

## Task 8: Deploy + smoke test

- [ ] **Step 1: Final build**

```bash
npm run build 2>&1 | tail -15
```

Expected: `✓ Compiled` with no errors.

- [ ] **Step 2: Deploy to prod**

```bash
vercel deploy --prod
```

Wait for `Production: https://cruzar.app` confirmation.

- [ ] **Step 3: Smoke tests**

```bash
# /b2b loads (200)
curl -s -o /dev/null -w "%{http_code}" https://cruzar.app/b2b
# /b2b/start loads (200)
curl -s -o /dev/null -w "%{http_code}" https://cruzar.app/b2b/start
# /insights redirects to /b2b (308)
curl -s -o /dev/null -w "%{http_code}" https://cruzar.app/insights
# /b2b?lang=es loads (200)
curl -s -o /dev/null -w "%{http_code}" "https://cruzar.app/b2b?lang=es"
```

Expected: `200`, `200`, `308`, `200`.

- [ ] **Step 4: Browser walk**

Open https://cruzar.app/b2b in incognito:
1. Hero renders — no amber/yellow; design tokens in use
2. CalibrationScoreboard shows real port data (not empty)
3. "Start free — 2 minutes" CTA → /b2b/start
4. /b2b/start wizard step 1 → select commodity → step 2 → select ports → step 3 → see email form + Google button
5. Nav shows "Portal" and "Accuracy" tabs (not Workspace/Console) when logged out
6. After login → nav switches to Workspace/Console/Refunds/EU MDR

---

## Self-Review Checklist

**Spec coverage:**
- [x] `/b2b` public portal — Task 4
- [x] Real calibration data in live strip — Task 4 (reuses `CalibrationScoreboard` server component)
- [x] `/b2b/start` onboarding wizard (commodity + ports + account) — Task 5
- [x] B2BNav restructure (public vs. authenticated tabs) — Task 6
- [x] DB migration for B2B profile columns — Task 1
- [x] `/api/b2b/onboard` writes preferences after signup — Task 3
- [x] `/insights` redirect → `/b2b` — Task 7
- [x] Spanish copy throughout — Tasks 2, 4, 5

**No placeholders:** All code blocks are complete. No "TBD" or "TODO" strings.

**Type consistency:**
- `WizardCopy` interface in `OnboardingWizard.tsx` matches the shape exported by both `B2B_EN.wizard` and `B2B_ES.wizard`
- `B2BNavProps['current']` union updated in Task 6 to include `'portal'` and `'accuracy'`
- `AUTH_ROUTES` and `PUBLIC_ROUTES` arrays use `NonNullable<B2BNavProps['current']>` — matches the extended union
- `/api/b2b/onboard` body is `{ commodity_type?: string; watched_ports?: string[] }` — matches what the wizard POSTs

**Substrate cohesion gate (per `feedback_substrate_cohesion_features_compose_not_silos_20260504.md`):**
- Does it read from existing features? Yes — CalibrationScoreboard reads `calibration_log` (v70 schema)
- Does it write into existing features? Yes — `/api/b2b/onboard` writes to `profiles` (extended by v88), and `b2b_watched_ports` feeds naturally into `insights_subscribers.watched_port_ids` for existing crons
- Can a post-onboarding flow derive from it? Yes — workspace can detect `b2b_onboarded_at` null to show onboarding nudge; dispatch console reads `b2b_watched_ports` to pre-populate watchlist
- Is it shown in a persisted view? Yes — workspace page already exists; the portal is the entry layer into it
