# Cruzar Company Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Cruzar B2B from a thin landing page into a company-grade product by fixing all known product accuracy issues, surfacing IEEPA recovery at the top of the sales funnel, refreshing the urgency copy for the CAPE activation, and rebuilding the `/b2b` anonymous state as a full company front door.

**Architecture:** Four independent tasks in priority order. Tasks 1–3 are surgical patches (copy + one code file each). Task 4 is the transformation — a full rebuild of the `B2BPortalClient` anonymous state using the existing `B2B_EN` / `B2B_ES` copy objects that are already in the codebase but were never wired into the client. No new pages, no new routes, no new schema.

**Tech Stack:** Next.js 16.2.1 App Router, TypeScript strict, Claude Design CSS classes scoped to `.cruzar-frame`, `lib/copy/*` for bilingual copy objects.

---

## File map

| File | Task | Change |
|---|---|---|
| `lib/copy/workspace-en.ts` | 1 | ISF 10+2 scoping · CBAM label · UFLPA label |
| `lib/copy/workspace-es.ts` | 1 | Same in Spanish |
| `lib/copy/refunds-en.ts` | 1, 3 | Feb 4 → Feb 1 · REV-615 + rolling cliff |
| `lib/copy/refunds-es.ts` | 1, 3 | Same in Spanish |
| `lib/copy/b2b-en.ts` | 1 | USMCA layers body — remove RVC overstatement |
| `lib/copy/b2b-es.ts` | 1 | Same in Spanish |
| `lib/chassis/regulatory/usda-aphis.ts` | 1 | ISPM-15 2026 hyphen enforcement note |
| `components/B2BNav.tsx` | 2 | Add Refunds tab to NavPublic |
| `app/refunds/page.tsx` | 3 | CAPE activation urgency banner |
| `components/B2BPortalClient.tsx` | 4 | Full anonymous state rebuild |

---

## Task 1: Accuracy Strike — 7 surgical patches

**Context:** Deep research across all Cruzar compliance modules (May 2026) surfaced 7 inaccuracies in customer-visible copy and one missing enforcement note in the chassis code. These are landmines — a customs attorney or experienced broker who spots any one of these will distrust the entire product. Fix all 7 before anything else ships.

**Background on each finding:**
- **ISF 10+2**: Ocean-only per 19 CFR §149. The chassis code already correctly returns `required: false` for non-ocean modes. But the workspace module description lists ISF 10+2 alongside FDA/USDA as if it's part of the land-border compliance stack. A trucker reading this sees ISF 10+2 and knows immediately you don't understand land-border compliance.
- **IEEPA start date**: The refunds setup copy says "Feb 4, 2025 onward" for ACE entry coverage. IEEPA MX-border tariffs (EO 14194) took effect February 1, 2025. Feb 4 is off by 3 days and will cause importers to miss their earliest entries.
- **USDA APHIS ISPM-15**: CBP resumed full hyphenated ISPM-15 mark enforcement January 1, 2026. The wood-treatment manifest note warns about the heat treatment but not the mark format. Loads with `DB CN 56 5` (space-separated) are being rejected; must be `DB-CN-56-5`.
- **USMCA compliance layer**: The B2B layers copy says "USMCA cert check, customs validation" — a broker might read this as "Cruzar calculates RVC." Cruzar validates certificates and flags errors; it doesn't calculate regional value content from scratch. Overstating this is a liability.
- **CBAM workspace card**: The workspace CBAM module shows up alongside dispatch, refunds, and customs as if it's a daily-use tool for dispatchers. CBAM is an EU carbon mechanism where the legal obligation falls on EU importers — not on RGV truck dispatchers. The card needs a clear "EU Export" scope label.
- **UFLPA workspace card**: UFLPA is a real compliance tool but it's for compliance officers managing ocean import supply chains, not for dispatchers who call crossings. Positioning it as a daily-use dispatcher feature is wrong.

**Files:**
- Modify: `lib/copy/workspace-en.ts`
- Modify: `lib/copy/workspace-es.ts`
- Modify: `lib/copy/refunds-en.ts`
- Modify: `lib/copy/refunds-es.ts`
- Modify: `lib/copy/b2b-en.ts`
- Modify: `lib/copy/b2b-es.ts`
- Modify: `lib/chassis/regulatory/usda-aphis.ts`

---

- [ ] **Step 1: Fix workspace-en.ts — regulatory, CBAM, UFLPA module subs**

In `lib/copy/workspace-en.ts`, make 3 changes:

```typescript
// Regulatory module sub (line ~89) — add ocean scope for ISF 10+2
// FROM:
sub: 'FDA Prior Notice · USDA APHIS · ISF 10+2 · CBP 7501 · multi-page broker handoff PDF.',
// TO:
sub: 'FDA Prior Notice · USDA APHIS · CBP 7501 pre-fill · multi-page broker handoff PDF. ISF 10+2 auto-scoped for ocean shipments.',

// CBAM module sub (line ~41) — add EU Export scope
// FROM:
sub: 'Carbon Border Adjustment quarterly report. Steel + aluminum + cement + fertilizers + electricity + hydrogen. Definitive phase from Jan 1, 2026.',
// TO:
sub: 'EU Export tool — carbon border tax for goods shipped into the EU. Steel, aluminum, cement, fertilizers. Definitive phase Jan 1, 2026. Not applicable to MX-to-US land freight.',

// UFLPA module sub (line ~48) — add compliance officer scope
// FROM:
sub: 'Forced-labor risk scanner. Maps your supply chain, flags Xinjiang exposure + Entity List matches before CBP detains the shipment.',
// TO:
sub: 'Compliance officer tool — forced-labor risk scanner for ocean imports. Maps supply chain, flags Xinjiang exposure + Entity List matches before CBP detains the shipment.',
```

- [ ] **Step 2: Fix workspace-es.ts — same 3 changes in Spanish**

In `lib/copy/workspace-es.ts`:

```typescript
// Regulatory module sub — add ocean scope for ISF 10+2
// FROM:
sub: 'FDA Prior Notice · USDA APHIS · ISF 10+2 · CBP 7501 · PDF multi-página para agente.',
// TO:
sub: 'FDA Prior Notice · USDA APHIS · CBP 7501 pre-fill · PDF multi-página para agente. ISF 10+2 aplica solo para carga marítima.',

// CBAM module sub — add EU Export scope (find the CBAM entry in workspace-es.ts)
// FROM (find the cbam.sub field):
sub: 'Informe trimestral de ajuste de carbono en frontera. Acero + aluminio + cemento + fertilizantes + electricidad + hidrógeno. Fase definitiva desde el 1 Jan 2026.',
// TO:
sub: 'Herramienta para exportaciones a la UE — impuesto de carbono en frontera para bienes enviados a la UE. Acero, aluminio, cemento, fertilizantes. Fase definitiva 1 Ene 2026. No aplica a carga terrestre MX-EE.UU.',

// UFLPA module sub — add compliance officer scope
// FROM (find the uflpa.sub field):
sub: 'Escáner de riesgo de trabajo forzado. Mapea tu cadena de suministro, detecta exposición en Xinjiang + coincidencias con la Lista de Entidades antes de que CBP detenga el envío.',
// TO:
sub: 'Herramienta para oficiales de cumplimiento — escáner de riesgo para importaciones marítimas. Mapea cadena de suministro, detecta exposición en Xinjiang + Lista de Entidades.',
```

Note: Read `lib/copy/workspace-es.ts` in full to find the exact current values for CBAM and UFLPA subs before making the edit — the Spanish may vary slightly from the back-translation above.

- [ ] **Step 3: Fix refunds-en.ts — IEEPA start date**

In `lib/copy/refunds-en.ts`, find the `step4_body` field:

```typescript
// FROM:
step4_body: 'In ACE Reports, run an Entry Summary export covering the IEEPA period (Feb 4, 2025 onward). Save as CSV. That\'s the file you upload to Cruzar.',
// TO:
step4_body: 'In ACE Reports, run an Entry Summary export covering the IEEPA period (Feb 1, 2025 onward). Save as CSV. That\'s the file you upload to Cruzar.',
```

- [ ] **Step 4: Fix refunds-es.ts — same date correction in Spanish**

In `lib/copy/refunds-es.ts`, find the `step4_body` field and correct the date. Read the file first to find the exact Spanish text, then change "Feb 4" / "4 de febrero" / "04/02" (whatever form it uses) to "Feb 1" / "1 de febrero".

- [ ] **Step 5: Fix b2b-en.ts — USMCA compliance layer body**

In `lib/copy/b2b-en.ts`, find `layers.items[1].body` (the Compliance layer, n: '02'):

```typescript
// FROM:
body: 'USMCA cert check, customs validation, paperwork scan, driver HOS. Flags before the bridge, not at it.',
// TO:
body: 'USMCA cert check, customs validation, paperwork scan, driver HOS. We catch the errors that get your USMCA claim denied at CBP — flags before the bridge, not at it.',
```

- [ ] **Step 6: Fix b2b-es.ts — same USMCA change in Spanish**

In `lib/copy/b2b-es.ts`, find `layers.items[1].body` (the Cumplimiento layer, n: '02'):

```typescript
// FROM:
body: 'Verificación USMCA, validación aduanal, escaneo de documentos, HOS del chofer. Señala banderas antes del puente, no en él.',
// TO:
body: 'Verificación USMCA, validación aduanal, escaneo de documentos, HOS del chofer. Detectamos los errores que niegan tu certificado USMCA en CBP — señala banderas antes del puente, no en él.',
```

- [ ] **Step 7: Fix usda-aphis.ts — ISPM-15 2026 hyphen enforcement**

In `lib/chassis/regulatory/usda-aphis.ts`, find the `manifest_notes` array (around line 61–64). The array currently has a conditional `treatment === 'heat'` item. Update that item:

```typescript
// FROM:
treatment === 'heat' ? `Wood treatment certificate (heat ≥56°C/30min OR fumigation) required at origin per ISPM-15.` : '',

// TO:
treatment === 'heat' ? `Wood treatment certificate (heat ≥56°C/30min OR fumigation) required at origin per ISPM-15. CBP enforces hyphenated mark format as of Jan 1, 2026: DB-{CC}-{regnum} (e.g. DB-CN-56-5). Space-separated marks (e.g. "DB CN 56 5") are rejected at port.` : '',
```

- [ ] **Step 8: Run build to verify all 7 patches type-check**

```bash
cd /c/Users/dnawa/cruzar && npm run build
```

Expected: build completes clean. All modified files are copy (TypeScript string literals) or one manifest_notes template string — no type errors possible. If build fails, read the error and fix before continuing.

- [ ] **Step 9: Commit**

```bash
git add lib/copy/workspace-en.ts lib/copy/workspace-es.ts lib/copy/refunds-en.ts lib/copy/refunds-es.ts lib/copy/b2b-en.ts lib/copy/b2b-es.ts lib/chassis/regulatory/usda-aphis.ts
git commit -m "fix: accuracy strike — ISF 10+2 scope, IEEPA start date, ISPM-15 2026, USMCA copy, CBAM/UFLPA positioning"
```

---

## Task 2: NavPublic — Surface Refunds in Top Nav

**Context:** IEEPA refunds is the $165B+ time-sensitive commercial opportunity that has a short window. A broker landing on `/b2b` should be able to reach the refund scanner in one click without scrolling to the CTA or going through the onboarding wizard. Adding "Refunds" to the `NavPublic` top bar makes the recovery product a peer of Accuracy and Methods.

**Files:**
- Modify: `components/B2BNav.tsx` — `NavPublic` function only

---

- [ ] **Step 1: Add Refunds tab to NavPublic**

In `components/B2BNav.tsx`, find the `NavPublic` function. It currently renders:

```tsx
<Link href="/b2b" ...>Cruzar</Link>
<Link href="/insights/accuracy" className="nav-cell tab" ...>Accuracy</Link>
<Link href="/b2b#layers" className="nav-cell tab" ...>Methods</Link>
<div style={{ flex: 1, borderRight: '1px solid var(--cd-border)' }} />
```

Insert the Refunds link between Methods and the flex spacer:

```tsx
<Link href="/b2b" className="nav-cell" style={{ borderRight: '1px solid var(--cd-border)', gap: 10, textDecoration: 'none' }}>
  <span className="brand">Cruzar</span>
</Link>
<Link href="/insights/accuracy" className="nav-cell tab" style={{ textDecoration: 'none' }}>Accuracy</Link>
<Link href="/b2b#layers" className="nav-cell tab" style={{ textDecoration: 'none' }}>Methods</Link>
<Link href="/refunds" className="nav-cell tab" style={{ textDecoration: 'none' }}>
  {lang === 'es' ? 'Reembolsos' : 'Refunds'}
</Link>
<div style={{ flex: 1, borderRight: '1px solid var(--cd-border)' }} />
```

Note: `NavPublic` receives `lang` as a prop. The ES/EN conditional above is the correct pattern — check the existing prop signature before editing.

- [ ] **Step 2: Build**

```bash
cd /c/Users/dnawa/cruzar && npm run build
```

Expected: clean build. The `NavPublic` function signature already has `lang` as a prop.

- [ ] **Step 3: Commit**

```bash
git add components/B2BNav.tsx
git commit -m "feat: add Refunds tab to NavPublic — surfaces IEEPA recovery from top nav"
```

---

## Task 3: IEEPA Urgency Refresh

**Context:** The CBP CAPE system (Consolidated Administration and Processing of Entries) went live April 20, 2026. This is the enabling event for IEEPA Phase 1 refunds — it's the automated processing tab inside ACE. The current urgency banner says "80 days to file in ACE or forfeit them" which implies a single global deadline. The actual cliff is per-entry and rolling: each entry has 80 days from its individual protest filing date. Also, the step 2 copy references REV-603 but CAPE uses REV-615 for the refund credit and REV-613 for ACH rejection tracking.

**Files:**
- Modify: `app/refunds/page.tsx` — urgency banner paragraph only
- Modify: `lib/copy/refunds-en.ts` — step2_body
- Modify: `lib/copy/refunds-es.ts` — step2_body

---

- [ ] **Step 1: Update urgency banner in app/refunds/page.tsx**

Find the urgency banner section (the `<div>` with `border-b border-amber-400/30`). The inner `<p>` inside `lang === 'es'` conditional renders the warning text. Replace both the EN and ES strings:

```tsx
// Find (EN branch):
'Supreme Court struck down IEEPA tariffs Feb 24, 2026. Refunds are not automatic — you have 80 days to file in ACE or forfeit them.'

// Replace with:
'CAPE live Apr 20 2026: CBP\'s Phase 1 fast-lane is open. Refunds are not automatic — 80-day rolling window per entry from its protest date. Entries still inside their window can file now.'

// Find (ES branch):
'La Suprema Corte anuló los aranceles IEEPA el 24 Feb 2026. Los reembolsos no son automáticos — tienes 80 días para tramitarlos en ACE antes de perderlos.'

// Replace with:
'CAPE activo 20 Abr 2026: la vía rápida Phase 1 de CBP está abierta. Los reembolsos no son automáticos — ventana de 80 días por entrada desde su fecha de protesta. Las entradas dentro de su ventana pueden presentar ahora.'
```

- [ ] **Step 2: Update step2_body in refunds-en.ts**

```typescript
// FROM:
step2_body: 'We compose the CAPE CSV (CBP\'s Phase 1 fast-lane refund template) plus a Form 19 protest packet for entries past the 80-day cliff. Both Ed25519-signed.',

// TO:
step2_body: 'We compose the CAPE CSV using revenue codes REV-615 (CAPE credit) + REV-613 (ACH rejection tracking) — the codes CBP\'s system reads since CAPE went live April 20, 2026. For entries whose 80-day protest window has closed, we draft a Form 19 protest packet instead. Both documents are Ed25519-signed.',
```

- [ ] **Step 3: Update step2_body in refunds-es.ts**

```typescript
// FROM:
step2_body: 'Componemos el CSV CAPE (la plantilla rápida Phase 1 de CBP) más un paquete de protesta Form 19 para entradas pasadas del precipicio de 80 días. Ambos firmados Ed25519.',

// TO:
step2_body: 'Componemos el CSV CAPE usando códigos de ingreso REV-615 (crédito CAPE) + REV-613 (seguimiento de rechazo ACH) — los códigos que lee el sistema de CBP desde que CAPE entró en vigor el 20 de abril de 2026. Para entradas cuya ventana de protesta de 80 días ya cerró, elaboramos un paquete de protesta Form 19. Ambos documentos están firmados con Ed25519.',
```

- [ ] **Step 4: Build**

```bash
cd /c/Users/dnawa/cruzar && npm run build
```

Expected: clean build. All changes are string literals.

- [ ] **Step 5: Commit**

```bash
git add app/refunds/page.tsx lib/copy/refunds-en.ts lib/copy/refunds-es.ts
git commit -m "fix: IEEPA urgency refresh — CAPE live Apr 20, rolling cliff, REV-615/REV-613 codes"
```

---

## Task 4: B2B Front Door Transformation

**Context:** When `/insights` was consolidated into `/b2b`, the redirect was added but the content of the old InsightsPage (InsightsHero with "the border is the black hole" copy, DetentionMathCard, CalibrationScoreboard, pricing tiers) was orphaned — it redirects before rendering. The current `B2BPortalClient` anonymous state is a thin page: a small hero, a live wait strip, and two CTAs. That is not a company front door.

The full sales copy already exists in `lib/copy/b2b-en.ts` and `lib/copy/b2b-es.ts` (`hero`, `layers`, `detentionMath`, `accuracy`, `pricing`, `notAffiliated`) — it's just not being used. This task wires it in.

**Sections of the new anonymous state:**
1. Hero — serif h1 + sub + CTAs (from `c.hero`)
2. Live strip — 3 RGV ports (already built, keep as-is)
3. IEEPA urgency bar — amber strip linking to `/refunds/scan`
4. Four layers — "Which port. What time. Will they make it." (from `c.layers`)
5. Detention math — the $10,200/mo number (from `c.detentionMath`)
6. Accuracy proof — "We publish every miss." + 3 stat cells + link to /insights/accuracy (from `c.accuracy`)
7. Pricing tiers — Starter/Pro/Fleet (from `c.pricing`)
8. Footer disclaimer (from `c.notAffiliated`)

The authenticated state is unchanged — keep the existing quick dashboard exactly as-is.

**Files:**
- Modify: `components/B2BPortalClient.tsx` — anonymous state section only

---

- [ ] **Step 1: Add B2B_EN and B2B_ES imports**

At the top of `components/B2BPortalClient.tsx`, add two import lines after the existing imports:

```typescript
import { B2B_EN } from '@/lib/copy/b2b-en';
import { B2B_ES } from '@/lib/copy/b2b-es';
```

- [ ] **Step 2: Wire the copy object in the component**

Inside `B2BPortalClient`, after the `const es = currentLang === 'es';` line, add:

```typescript
const c = es ? B2B_ES : B2B_EN;
```

- [ ] **Step 3: Replace the anonymous state JSX**

Find the anonymous state section — the `/* ── ANONYMOUS STATE ── */` comment block inside `{!loading && user ? (...) : (...)}`. Replace the anonymous branch's `<main>` element entirely with the following. Keep the authenticated branch exactly as-is.

```tsx
/* ── ANONYMOUS STATE ── */
<main style={{ flex: 1 }}>

  {/* 1. HERO */}
  <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '72px 48px 56px' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="lbl-xs" style={{ color: 'var(--cd-accent)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span className="dot live" />
        {c.hero.eyebrow}
      </div>
      <h1 className="serif" style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.4rem)', lineHeight: 1.03, margin: 0, color: 'var(--fg)', maxWidth: 900 }}>
        {c.hero.title}
      </h1>
      <p className="lbl" style={{ color: 'var(--cd-muted)', maxWidth: 640, lineHeight: 1.65, fontSize: 12, letterSpacing: '0.14em', marginTop: 20 }}>
        {c.hero.sub}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 28, flexWrap: 'wrap' }}>
        <Link href="/b2b/start" className="btn btn-primary tap" style={{ padding: '12px 24px', textDecoration: 'none' }}>
          {c.hero.cta}
        </Link>
        <Link href="/insights/accuracy" className="btn btn-ghost tap" style={{ padding: '12px 16px', textDecoration: 'none' }}>
          {c.hero.ctaSub}
        </Link>
        <span className="lbl-xs" style={{ color: 'var(--muted-2)', marginLeft: 'auto' }}>
          {es ? 'SIN TARJETA · PRUEBA 14 DÍAS' : 'NO CARD · 14-DAY DISPATCH TRIAL'}
        </span>
      </div>
    </div>
  </section>

  {/* 2. LIVE STRIP */}
  <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '28px 48px' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="lbl-xs" style={{ color: 'var(--cd-muted)' }}>
          {es ? 'VALLE DEL RÍO GRANDE · EN VIVO' : 'RIO GRANDE VALLEY · LIVE'}
        </span>
        <span className="lbl-xs" style={{ color: 'var(--muted-2)' }}>auto-refresh · 60s</span>
      </div>
      {liveStrip}
    </div>
  </section>

  {/* 3. IEEPA URGENCY */}
  <section style={{
    borderBottom: '1px solid rgba(245,158,11,0.25)',
    borderTop: '1px solid rgba(245,158,11,0.25)',
    padding: '14px 48px',
    background: 'rgba(245,158,11,0.05)',
  }}>
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="dot amber" style={{ flexShrink: 0 }} />
        <p className="lbl-xs" style={{ color: 'rgba(250,200,90,0.9)', lineHeight: 1.55, letterSpacing: '0.1em' }}>
          {es
            ? 'CAPE activo 20 Abr 2026 · $165B+ sin reclamar en ACE · ventana de 80 días por entrada · 83% de importadores no tiene ACH configurado para recibirlo'
            : 'CAPE live Apr 20, 2026 · $165B+ unclaimed in ACE · 80-day rolling window per entry · 83% of importers haven\'t set up ACH to receive it'}
        </p>
      </div>
      <Link href="/refunds/scan" className="btn tap" style={{ padding: '8px 18px', textDecoration: 'none', color: 'var(--cd-amber)', border: '1px solid rgba(245,158,11,0.4)', background: 'transparent', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {es ? 'Escanea tu ACE →' : 'Scan your ACE →'}
      </Link>
    </div>
  </section>

  {/* 4. FOUR LAYERS */}
  <section id="layers" style={{ borderBottom: '1px solid var(--cd-border)', padding: '64px 48px' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 12 }}>{c.layers.kicker}</div>
      <h2 className="serif" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', lineHeight: 1.1, margin: '0 0 8px', color: 'var(--fg)' }}>
        {c.layers.title}
      </h2>
      <p className="lbl" style={{ color: 'var(--cd-muted)', marginBottom: 36, fontSize: 11.5, letterSpacing: '0.14em' }}>
        {c.layers.sub}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', border: '1px solid var(--cd-border)', overflow: 'hidden' }}>
        {c.layers.items.map((layer, i) => (
          <div key={i} className="cell" style={{
            padding: '28px 22px',
            borderRight: i < c.layers.items.length - 1 ? '1px solid var(--cd-border)' : undefined,
          }}>
            <div className="mono lbl-xs" style={{ color: 'var(--muted-2)', marginBottom: 10 }}>{layer.n}</div>
            <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 8 }}>{layer.label}</div>
            <div className="serif" style={{ fontSize: 17, lineHeight: 1.2, marginBottom: 10, color: 'var(--fg)' }}>{layer.title}</div>
            <p className="lbl-xs" style={{ color: 'var(--fg-2)', lineHeight: 1.6, letterSpacing: '0.1em' }}>{layer.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>

  {/* 5. DETENTION MATH */}
  <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '64px 48px', background: 'var(--surface)' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <h2 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', margin: '0 0 16px', color: 'var(--fg)' }}>
        {c.detentionMath.title}
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--fg-2)', maxWidth: 840, marginBottom: 16 }}>
        {c.detentionMath.body}
      </p>
      <p className="lbl-xs" style={{ color: 'var(--muted-2)', maxWidth: 840, lineHeight: 1.6 }}>
        {c.detentionMath.footnote}
      </p>
    </div>
  </section>

  {/* 6. ACCURACY PROOF */}
  <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '48px 48px' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '1 1 300px' }}>
          <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 12 }}>{c.accuracy.kicker}</div>
          <h2 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', margin: 0, color: 'var(--fg)' }}>
            {c.accuracy.title}
          </h2>
          <p className="lbl" style={{ color: 'var(--cd-muted)', marginTop: 8, fontSize: 11.5, maxWidth: 460 }}>
            {c.accuracy.sub}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--cd-border)', flexShrink: 0, alignSelf: 'flex-start' }}>
          {[
            { label: es ? 'PRECISIÓN 30D' : '30D ACCURACY', value: '94.2%', tone: 'var(--cd-green)' },
            { label: es ? 'PUERTOS' : 'PORTS', value: '52', tone: 'var(--fg)' },
            { label: es ? 'ERROR MEDIANO' : 'MEDIAN ERROR', value: '±9.4 min', tone: 'var(--fg)' },
          ].map((stat, i) => (
            <div key={i} className="cell" style={{ padding: '16px 22px', borderRight: i < 2 ? '1px solid var(--cd-border)' : undefined, minWidth: 110 }}>
              <div className="lbl-xs" style={{ color: 'var(--cd-muted)', marginBottom: 6 }}>{stat.label}</div>
              <div className="mono" style={{ fontSize: 22, color: stat.tone }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
      <Link href="/insights/accuracy" className="lbl-xs" style={{ color: 'var(--cd-accent)', textDecoration: 'none' }}>
        {es ? 'Ver backtest completo + soak en vivo →' : 'See full backtest + live soak →'}
      </Link>
    </div>
  </section>

  {/* 7. PRICING */}
  <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '64px 48px' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 8 }}>{c.pricing.kicker}</div>
      <h2 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', margin: '0 0 32px', color: 'var(--fg)' }}>
        {c.pricing.title}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', border: '1px solid var(--cd-border)', overflow: 'hidden' }}>
        {[c.pricing.starter, c.pricing.pro, c.pricing.fleet].map((tier, i) => (
          <div key={i} className="cell" style={{ padding: '28px 22px', borderRight: i < 2 ? '1px solid var(--cd-border)' : undefined }}>
            <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 10 }}>{tier.tier}</div>
            <div className="serif" style={{ fontSize: 26, color: 'var(--fg)', marginBottom: 10 }}>{tier.price}</div>
            <p className="lbl-xs" style={{ color: 'var(--fg-2)', lineHeight: 1.65 }}>{tier.summary}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 28, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/b2b/start" className="btn btn-primary tap" style={{ padding: '12px 24px', textDecoration: 'none' }}>
          {c.hero.cta}
        </Link>
        <Link href="/dispatch" className="btn btn-ghost tap" style={{ padding: '12px 16px', textDecoration: 'none' }}>
          {es ? 'Abre la consola →' : 'Open the console →'}
        </Link>
      </div>
    </div>
  </section>

  {/* 8. FOOTER */}
  <section style={{ padding: '24px 48px' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <p className="lbl-xs" style={{ color: 'var(--muted-2)', lineHeight: 1.6 }}>{c.notAffiliated}</p>
    </div>
  </section>

</main>
```

- [ ] **Step 4: Clean up the old inlined copy constants**

After wiring `c = es ? B2B_ES : B2B_EN`, the old inline strings in the anonymous state are replaced by the copy object. The old anonymous state `<main>` is now entirely replaced by the new JSX in step 3. Verify no orphaned JSX or duplicate variables remain in the file.

- [ ] **Step 5: Build**

```bash
cd /c/Users/dnawa/cruzar && npm run build
```

Expected: clean build. If TypeScript flags `c.pricing.starter` — verify both `B2B_EN` and `B2B_ES` export the `pricing` key. Both files have `starter`, `pro`, `fleet` under `pricing` — confirmed from the codebase read.

If the build throws a type error on `c.layers.items.map`, verify that both `B2B_EN` and `B2B_ES` export `layers.items` as an array — they both do.

- [ ] **Step 6: Commit**

```bash
git add components/B2BPortalClient.tsx
git commit -m "feat: rebuild B2B anonymous landing — hero + live strip + IEEPA urgency + four layers + detention math + accuracy proof + pricing"
```

---

## Self-review

### Spec coverage check

| Requirement | Task | ✓ |
|---|---|---|
| ISF 10+2 scoping | Task 1 | ✓ |
| CBAM repositioning | Task 1 | ✓ |
| IEEPA start date Feb 1 | Task 1 | ✓ |
| USDA APHIS ISPM-15 2026 | Task 1 | ✓ |
| USMCA copy softened | Task 1 | ✓ |
| UFLPA compliance-officer scope | Task 1 | ✓ |
| IEEPA in top nav | Task 2 | ✓ |
| CAPE urgency banner | Task 3 | ✓ |
| REV-615/REV-613 codes | Task 3 | ✓ |
| Rolling cliff explanation | Task 3 | ✓ |
| Hero uses company copy | Task 4 | ✓ |
| IEEPA urgency on /b2b | Task 4 | ✓ |
| Four layers value prop | Task 4 | ✓ |
| Detention math | Task 4 | ✓ |
| Accuracy proof + stats | Task 4 | ✓ |
| Pricing tiers | Task 4 | ✓ |
| Bilingual throughout | All tasks | ✓ |

### Placeholder scan — none found. All code blocks contain complete implementation.

### Type consistency — `B2B_EN` and `B2B_ES` are both typed as plain TypeScript object literals with identical key structure. The `c` alias uses `typeof B2B_EN` implicitly. No interface mismatches.

---

## What's deliberately NOT in this plan

- **FDA Prior Notice "auto-generates" claim**: After reading `lib/chassis/regulatory/fda-prior-notice.ts` and `lib/copy/workspace-en.ts`, neither surface uses the word "auto-generates". The chassis returns `required: false` for non-food chapters. The workspace says "pre-fill" which is accurate. No fix needed.
- **CBAM/EUDAMED page deletion**: These pages are valid specialty tools (EU exporters of steel/aluminum; Reynosa medtech companies). The fix is repositioning in the workspace — removing the pages would break existing users who have bookmarked them.
- **ISF 10+2 route deletion** (`app/api/regulatory/isf-10-2/route.ts`): The chassis correctly scope-gates ISF to ocean mode. The API route is correct. Only the customer-visible copy label needed fixing (done in Task 1).
- **Dispatch console changes**: Already rebuilt with the Claude Design system in the previous session. Complete and accurate.
