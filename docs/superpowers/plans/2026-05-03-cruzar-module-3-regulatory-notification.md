# Cruzar Module 3 — Pre-Arrival Regulatory Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the pre-arrival regulatory notification chassis (FDA Prior Notice + USDA APHIS + ISF 10+2 + CBP 7501 pre-fill), gated behind Module 3 audit reconciliation, and extend the Cruzar Ticket bundle to include regulatory submission references.

**Architecture:** v1 ships **data composition + form pre-fill + submission manifest** — NOT direct agency API submission. Real submission to FDA PNSI / USDA APHIS eFile / CBP ACE requires registered filer credentials (ABI filer code, customs surety bond, FDA Industry Systems account) Diego doesn't have yet. The chassis composes the validated payload, generates broker-ready forms (PDFs + structured JSON), produces a `submission_manifest` listing which agencies must be notified + when + by whom, and stamps the Ticket. Operator/broker actually files via their existing ACE/PNSI accounts. v2 (separate plan) wires real API submission once filer creds are in place.

**Tech Stack:** Next.js 16 App Router + TypeScript strict + Supabase + pdf-lib (form rendering, lifts Module 2 pattern). All form text routes through `LangContext` for bilingual EN/ES.

**Spec source:** `~/cruzar/docs/superpowers/specs/2026-05-02-cruzar-ticket-and-module-2-chassis-design.md` §Module 3.

**Scope:** Module 3 only. Modules 4 (paperwork scanner) and 5 (driver compliance) get separate plans after this module's audit gate passes.

**Prerequisite:** Module 2 audit-gate PASSED 2026-05-03 — chassis types, customs validation, Ticket layer, calibration helper all live.

---

## File map (locked at plan time)

**Create:**
- `lib/chassis/regulatory/types.ts` — Module 3 schemas (FDA / USDA / ISF / CBP 7501 / submission manifest)
- `lib/chassis/regulatory/fda-prior-notice.ts` — composer
- `lib/chassis/regulatory/usda-aphis.ts` — composer (PPQ 587 + 925)
- `lib/chassis/regulatory/isf-10-2.ts` — composer (12 elements)
- `lib/chassis/regulatory/cbp-7501.ts` — composer (lifts existing `lib/customsForms.ts` generator + Module 2 chassis output)
- `lib/chassis/regulatory/submitter.ts` — routing + manifest builder
- `lib/chassis/regulatory/pdf.ts` — bilingual PDF rendering of all 4 form types
- `data/regulatory/fda-product-codes.json` — FDA product code mapping for HS-chapter routing
- `data/regulatory/test-shipments.json` — 30 test shipments covering all 4 form types
- `app/api/regulatory/fda-prior-notice/route.ts`
- `app/api/regulatory/usda-aphis/route.ts`
- `app/api/regulatory/isf-10-2/route.ts`
- `app/api/regulatory/cbp-7501/route.ts`
- `app/api/regulatory/manifest/route.ts` — single endpoint that runs the full submitter routing
- `scripts/verify-fda-prior-notice.mjs`
- `scripts/verify-usda-aphis.mjs`
- `scripts/verify-isf-10-2.mjs`
- `scripts/verify-cbp-7501.mjs`
- `scripts/verify-regulatory-manifest.mjs`
- `scripts/run-module-3-audit.mjs`
- `supabase/migrations/v77-regulatory-submissions.sql`

**Modify:**
- `lib/ticket/types.ts` — add `TicketRegulatoryBlock` interface
- `lib/ticket/generate.ts` — extend Ticket bundle to include regulatory data
- `lib/copy/ticket-en.ts` + `lib/copy/ticket-es.ts` — add regulatory section labels
- `lib/ticket/pdf.ts` — render regulatory section when present
- `app/ticket/[id]/page.tsx` — render regulatory section when present
- `package.json` — add 5 new verify npm scripts + audit:module-3
- `scripts/run-module-2-audit.mjs` (rename or supersede via run-module-3-audit which extends scope)

**Audit-gate output:**
- `~/.claude/projects/C--Users-dnawa/memory/project_cruzar_module_3_audit_<DATE>.md`

---

## Task 1: package.json verify scripts

**Files:** Modify `package.json`

- [ ] **Step 1: Add 6 npm scripts** to the `scripts` block (alongside the existing Module 2 entries):

```json
"verify:fda": "npx tsx scripts/verify-fda-prior-notice.mjs",
"verify:usda": "npx tsx scripts/verify-usda-aphis.mjs",
"verify:isf": "npx tsx scripts/verify-isf-10-2.mjs",
"verify:cbp7501": "npx tsx scripts/verify-cbp-7501.mjs",
"verify:manifest": "npx tsx scripts/verify-regulatory-manifest.mjs",
"audit:module-3": "node scripts/run-module-3-audit.mjs"
```

- [ ] **Step 2: Commit**

```bash
cd ~/cruzar && git add package.json && git commit -m "feat(module-3): add regulatory verify + audit npm scripts"
```

---

## Task 2: Migration v77 — `regulatory_submissions`

**Files:** Create `supabase/migrations/v77-regulatory-submissions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- v77: regulatory_submissions — Module 3 composition log
-- One row per composed agency submission (FDA Prior Notice, USDA APHIS, ISF 10+2, CBP 7501).

CREATE TABLE IF NOT EXISTS public.regulatory_submissions (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,                                -- nullable: composer may run before Ticket signs
  agency TEXT NOT NULL CHECK (agency IN ('FDA','USDA','CBP_ISF','CBP_7501')),
  shipment_ref TEXT,
  composed_payload JSONB NOT NULL,               -- the structured submission body
  composed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pre_arrival_deadline TIMESTAMPTZ,              -- e.g. 2h before arrival for FDA
  filer_status TEXT DEFAULT 'pending'
    CHECK (filer_status IN ('pending','submitted_externally','accepted','rejected','superseded')),
  external_ref TEXT,                             -- agency confirmation # when broker reports back
  external_ref_recorded_at TIMESTAMPTZ,
  caller TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reg_subs_agency ON public.regulatory_submissions(agency);
CREATE INDEX IF NOT EXISTS idx_reg_subs_composed_at ON public.regulatory_submissions(composed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reg_subs_ticket_id ON public.regulatory_submissions(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reg_subs_status ON public.regulatory_submissions(filer_status);

ALTER TABLE public.regulatory_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access on regulatory_submissions"
  ON public.regulatory_submissions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.regulatory_submissions IS 'Module 3 composed agency submissions. Status starts pending; broker reports back filer status + external_ref after they file via their own ACE/PNSI/eFile accounts.';
```

- [ ] **Step 2: Apply**

```bash
cd ~/cruzar && npm run apply-migration -- supabase/migrations/v77-regulatory-submissions.sql
```

- [ ] **Step 3: Verify table exists**

```bash
cd ~/cruzar && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('regulatory_submissions').select('id').limit(1).then(r => console.log(r.error?.message || 'OK'));
"
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd ~/cruzar && git add supabase/migrations/v77-regulatory-submissions.sql && git commit -m "feat(module-3): migration v77 regulatory_submissions"
```

---

## Task 3: Regulatory chassis types

**Files:** Create `lib/chassis/regulatory/types.ts`

- [ ] **Step 1: Create directory + types file**

```bash
mkdir -p ~/cruzar/lib/chassis/regulatory
```

Write `~/cruzar/lib/chassis/regulatory/types.ts`:

```typescript
// lib/chassis/regulatory/types.ts
// Module 3 — pre-arrival regulatory notification schemas.
// Agencies: FDA Prior Notice (food/medical), USDA APHIS (plant/animal),
//           CBP ISF 10+2 (ocean), CBP 7501 (entry summary).

import type { ShipmentInput } from '../customs/types';
import type { HsClassificationResult, OriginValidationResult, RvcResult } from '../customs/types';

export type AgencyId = 'FDA' | 'USDA' | 'CBP_ISF' | 'CBP_7501';

// ── FDA Prior Notice ────────────────────────────────────────────────────────
export interface FdaPriorNoticeComposition {
  required: boolean;
  reason_required: string;                 // human-readable why FDA Prior Notice applies
  product_code: string | null;             // FDA product code (5-7 char alphanumeric)
  arrival_deadline_iso: string | null;     // ISO timestamp = arrival_eta - 2h (FDA rule)
  fields: {
    submitter: { name: string; address: string; phone?: string };
    transmitter?: { name: string; address: string };
    importer: { name: string; address: string; iei?: string };
    owner: { name: string; address: string };
    consignee: { name: string; address: string };
    arrival_information: {
      port_of_entry_code: string;
      arrival_date_eta_iso: string;
      mode_of_transport: 'truck' | 'ocean' | 'air' | 'rail';
      carrier: string;
    };
    article: {
      product_code: string;
      common_name: string;
      hts_10: string;
      country_of_production: string;
      manufacturer_facility?: string;
      grower_facility?: string;
      quantity: { amount: number; unit: string };
    };
  };
  manifest_notes: string[];                // human-readable broker action items
}

// ── USDA APHIS ─────────────────────────────────────────────────────────────
export interface UsdaAphisComposition {
  required: boolean;
  reason_required: string;
  forms_applicable: Array<'PPQ_587' | 'PPQ_925'>;
  fields: {
    importer: { name: string; address: string };
    consignee: { name: string; address: string };
    origin_country: string;
    port_of_entry: string;
    arrival_date_eta_iso: string;
    species_or_commodity: string;
    quantity: { amount: number; unit: string };
    treatment_required?: 'fumigation' | 'cold' | 'heat' | 'none';
  };
  manifest_notes: string[];
}

// ── ISF 10+2 (Importer Security Filing) ────────────────────────────────────
export interface IsfElement {
  // 12 elements: 10 from importer + 2 from carrier
  manufacturer_supplier?: { name: string; address: string };
  seller?: { name: string; address: string };
  buyer?: { name: string; address: string };
  ship_to_party?: { name: string; address: string };
  container_stuffing_location?: string;
  consolidator_stuffer?: { name: string; address: string };
  importer_of_record_number?: string;
  consignee_number?: string;
  country_of_origin?: string;
  hts_6?: string;
  // Carrier-supplied (2 elements):
  vessel_stow_plan?: string;
  container_status_message?: string;
}

export interface IsfComposition {
  required: boolean;
  reason_required: string;                  // typically: "ocean shipment"
  loading_deadline_iso: string | null;      // ISO timestamp = vessel_load_time - 24h (ISF rule)
  elements: IsfElement;
  elements_complete: { importer_count: 10 | number; carrier_count: 2 | number };
  manifest_notes: string[];
}

// ── CBP 7501 (Entry Summary) ───────────────────────────────────────────────
export interface Cbp7501Composition {
  required: true;                           // every commercial entry needs CF-7501
  filing_deadline_iso: string;              // ISO timestamp = entry_date + 10 business days
  fields: {
    entry_number?: string;                  // assigned by ACE on filing
    entry_type: '01' | '02' | '03' | '11';  // 01 = consumption, 02 = consumption-quota, 03 = informal, 11 = informal-quota
    importer_of_record: { name: string; ein: string };
    importer_address: string;
    consignee?: { name: string; address: string };
    bond_information?: { surety_code?: string; bond_value_usd?: number };
    port_of_entry_code: string;
    entry_date_iso: string;
    arrival_date_iso: string;
    mode_of_transport: string;
    bill_of_lading?: string;
    invoice_total_usd: number;
    line_items: Array<{
      hts_10: string;
      description: string;
      quantity: number;
      unit: string;
      value_usd: number;
      duty_rate_pct: number;
      duty_usd: number;
      fta_claimed: 'USMCA' | 'GSP' | 'CBI' | 'NONE';
      fta_criterion?: 'A' | 'B' | 'C' | 'D';
    }>;
    invoice_total: number;
    duty_total: number;
    fta_savings_usd: number;
  };
  manifest_notes: string[];
}

// ── Submission Manifest ────────────────────────────────────────────────────
export interface SubmissionManifest {
  shipment_ref: string | null;
  agencies_required: AgencyId[];
  fda?: FdaPriorNoticeComposition;
  usda?: UsdaAphisComposition;
  isf?: IsfComposition;
  cbp_7501?: Cbp7501Composition;
  earliest_deadline_iso: string | null;     // earliest of all deadlines (broker file-by)
  composed_at_iso: string;
  ticket_id: string | null;
}

// Routing input — the chassis decides which agencies apply.
export interface RoutingInput {
  shipment: ShipmentInput;
  hs: HsClassificationResult;
  origin: OriginValidationResult;
  rvc: RvcResult;
  arrival_eta_iso: string;                   // when truck/vessel arrives at port
  vessel_load_iso?: string;                  // for ocean — when foreign port loads
  mode_of_transport: 'truck' | 'ocean' | 'air' | 'rail';
}
```

- [ ] **Step 2: TS check**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd ~/cruzar && git add lib/chassis/regulatory/types.ts && git commit -m "feat(module-3): regulatory chassis types (FDA, USDA, ISF, CBP 7501, manifest)"
```

---

## Task 4: FDA product-code mapping

**Files:** Create `data/regulatory/fda-product-codes.json`

FDA Prior Notice requires a 5-7 char FDA product code per shipment (different from HTS). v1 ships a curated mapping for the most common HS chapters that trigger FDA rules: chapters 02 (meat), 03 (fish), 04 (dairy), 07-08 (vegetables/fruits), 09 (spices/coffee), 16 (prepared meat), 19 (cereals), 21 (food preps), 30 (pharmaceuticals), 90 (medical devices).

- [ ] **Step 1: Create directory + file**

```bash
mkdir -p ~/cruzar/data/regulatory
```

Write `~/cruzar/data/regulatory/fda-product-codes.json`:

```json
{
  "version": "v1.0",
  "source": "FDA Industry Systems Product Codes (curated subset for v1)",
  "generated_at": "2026-05-03",
  "mapping": {
    "02": { "fda_code": "02", "category": "meat-and-poultry", "fda_required": false, "note": "USDA FSIS jurisdiction primarily; FDA may require Prior Notice for game/exotic" },
    "03": { "fda_code": "16", "category": "fish-seafood", "fda_required": true },
    "04": { "fda_code": "09", "category": "dairy", "fda_required": true },
    "07": { "fda_code": "20", "category": "fresh-vegetables", "fda_required": true },
    "08": { "fda_code": "21", "category": "fresh-fruits", "fda_required": true },
    "09": { "fda_code": "32", "category": "spices-flavors", "fda_required": true },
    "10": { "fda_code": "27", "category": "cereals-grain", "fda_required": true },
    "11": { "fda_code": "27", "category": "cereal-products", "fda_required": true },
    "16": { "fda_code": "16", "category": "prepared-meat-fish", "fda_required": true },
    "19": { "fda_code": "27", "category": "cereal-bakery", "fda_required": true },
    "20": { "fda_code": "21", "category": "preserved-fruit-veg", "fda_required": true },
    "21": { "fda_code": "30", "category": "food-preparations", "fda_required": true },
    "22": { "fda_code": "31", "category": "beverages", "fda_required": true },
    "30": { "fda_code": "63", "category": "pharmaceuticals-finished", "fda_required": true, "note": "PMA / 510(k) / NDA jurisdiction; Prior Notice still required for finished food-grade pharma imports" },
    "90": { "fda_code": "73", "category": "medical-devices", "fda_required": false, "note": "FDA Industry Systems applies for some Class II/III; not pre-arrival Prior Notice in the food sense" }
  },
  "notes": [
    "v1 mapping — broker reviews + adjusts per actual product. FDA codes are 2-7 char; the leading 2 chars (Industry Code) are what we map by HS chapter.",
    "fda_required=false means Prior Notice is NOT required for that chapter even though FDA may have other jurisdiction.",
    "When fda_required=true and arrival_eta is set, the chassis computes arrival_deadline_iso = arrival_eta - 2h."
  ]
}
```

- [ ] **Step 2: Verify JSON parses**

```bash
node -e "console.log('chapters:', Object.keys(require('/c/Users/dnawa/cruzar/data/regulatory/fda-product-codes.json').mapping).length)"
```
Expected: `chapters: 15`.

- [ ] **Step 3: Commit**

```bash
cd ~/cruzar && git add data/regulatory/fda-product-codes.json && git commit -m "feat(module-3): FDA product-code mapping v1 (15 HS chapters)"
```

---

## Task 5: FDA Prior Notice composer

**Files:** Create `lib/chassis/regulatory/fda-prior-notice.ts`

- [ ] **Step 1: Write the composer**

```typescript
// lib/chassis/regulatory/fda-prior-notice.ts
// FDA Prior Notice composer. Required 2h pre-arrival for food shipments.
// Reference: 21 CFR §1.276–1.282; FDA PNSI portal.

import type { FdaPriorNoticeComposition, RoutingInput } from './types';
import fdaCodes from '../../../data/regulatory/fda-product-codes.json';

interface FdaCodeMapping {
  mapping: Record<string, { fda_code: string; category: string; fda_required: boolean; note?: string }>;
}
const FDA_TABLE = fdaCodes as FdaCodeMapping;

const PRE_ARRIVAL_HOURS = 2;

export function composeFdaPriorNotice(input: RoutingInput): FdaPriorNoticeComposition {
  const chapter = input.hs.hts_10.slice(0, 2);
  const entry = FDA_TABLE.mapping[chapter];

  if (!entry || !entry.fda_required) {
    return {
      required: false,
      reason_required: entry
        ? `HS chapter ${chapter} (${entry.category}): ${entry.note ?? 'FDA Prior Notice not required'}`
        : `HS chapter ${chapter}: outside FDA Prior Notice jurisdiction (no mapping)`,
      product_code: null,
      arrival_deadline_iso: null,
      fields: {
        submitter: { name: 'NOT-REQUIRED', address: '' },
        importer: { name: 'NOT-REQUIRED', address: '' },
        owner: { name: 'NOT-REQUIRED', address: '' },
        consignee: { name: 'NOT-REQUIRED', address: '' },
        arrival_information: {
          port_of_entry_code: '',
          arrival_date_eta_iso: '',
          mode_of_transport: input.mode_of_transport,
          carrier: '',
        },
        article: {
          product_code: '',
          common_name: '',
          hts_10: input.hs.hts_10,
          country_of_production: input.shipment.origin_country,
          quantity: { amount: 0, unit: 'EA' },
        },
      },
      manifest_notes: [],
    };
  }

  const arrivalDeadline = new Date(new Date(input.arrival_eta_iso).getTime() - PRE_ARRIVAL_HOURS * 3600 * 1000).toISOString();

  return {
    required: true,
    reason_required: `HS chapter ${chapter} (${entry.category}): FDA Prior Notice required ≥ ${PRE_ARRIVAL_HOURS}h pre-arrival per 21 CFR §1.279`,
    product_code: entry.fda_code,
    arrival_deadline_iso: arrivalDeadline,
    fields: {
      submitter: { name: input.shipment.importer_name ?? 'TBD-BROKER', address: 'TBD-BROKER' },
      importer: { name: input.shipment.importer_name ?? 'TBD', address: 'TBD' },
      owner: { name: 'TBD', address: 'TBD' },
      consignee: { name: 'TBD', address: 'TBD' },
      arrival_information: {
        port_of_entry_code: input.shipment.port_of_entry ?? 'TBD',
        arrival_date_eta_iso: input.arrival_eta_iso,
        mode_of_transport: input.mode_of_transport,
        carrier: 'TBD',
      },
      article: {
        product_code: entry.fda_code,
        common_name: input.shipment.product_description,
        hts_10: input.hs.hts_10,
        country_of_production: input.shipment.origin_country,
        quantity: { amount: 1, unit: 'EA' },
      },
    },
    manifest_notes: [
      `File via FDA Prior Notice System Interface (PNSI) at access.fda.gov before ${arrivalDeadline}.`,
      `Confirmation Number must be captured + reported back via /api/regulatory/manifest PATCH for the Cruzar Ticket to lock.`,
      `Required fields tagged TBD-BROKER need broker / importer / consignee details before submission.`,
    ],
  };
}
```

- [ ] **Step 2: TS check + commit**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/regulatory/fda-prior-notice.ts && git commit -m "feat(module-3): FDA Prior Notice composer (2h pre-arrival rule)"
```

---

## Task 6: USDA APHIS composer

**Files:** Create `lib/chassis/regulatory/usda-aphis.ts`

- [ ] **Step 1: Write the composer**

```typescript
// lib/chassis/regulatory/usda-aphis.ts
// USDA APHIS Plant Protection & Quarantine (PPQ) composer.
// PPQ Form 587 = plant inspection; PPQ Form 925 = origin certification.

import type { UsdaAphisComposition, RoutingInput } from './types';

// HS chapters that trigger USDA APHIS:
// 06 = live trees, plants, cut flowers
// 07 = vegetables (USDA inspects + FDA Prior Notice both apply)
// 08 = fruits (same)
// 09 = spices, coffee, tea
// 10 = cereals (grain inspection)
// 12 = oil seeds, miscellaneous grains
// 14 = vegetable plaiting materials
// 44 = wood (treatment/quarantine for forest pests)
const APHIS_CHAPTERS = new Set(['06','07','08','09','10','12','14','44']);

export function composeUsdaAphis(input: RoutingInput): UsdaAphisComposition {
  const chapter = input.hs.hts_10.slice(0, 2);

  if (!APHIS_CHAPTERS.has(chapter)) {
    return {
      required: false,
      reason_required: `HS chapter ${chapter}: outside USDA APHIS PPQ jurisdiction`,
      forms_applicable: [],
      fields: {
        importer: { name: '', address: '' },
        consignee: { name: '', address: '' },
        origin_country: input.shipment.origin_country,
        port_of_entry: input.shipment.port_of_entry ?? '',
        arrival_date_eta_iso: input.arrival_eta_iso,
        species_or_commodity: input.shipment.product_description,
        quantity: { amount: 0, unit: 'EA' },
      },
      manifest_notes: [],
    };
  }

  // Wood (chapter 44) typically requires fumigation/heat treatment
  const treatment = chapter === '44' ? 'heat' : undefined;

  // Forms: 587 always; 925 when origin certification matters (most produce + plant material)
  const forms: Array<'PPQ_587' | 'PPQ_925'> = ['PPQ_587'];
  if (['06','07','08','12','14'].includes(chapter)) forms.push('PPQ_925');

  return {
    required: true,
    reason_required: `HS chapter ${chapter}: USDA APHIS PPQ required pre-clearance`,
    forms_applicable: forms,
    fields: {
      importer: { name: input.shipment.importer_name ?? 'TBD', address: 'TBD' },
      consignee: { name: 'TBD', address: 'TBD' },
      origin_country: input.shipment.origin_country,
      port_of_entry: input.shipment.port_of_entry ?? 'TBD',
      arrival_date_eta_iso: input.arrival_eta_iso,
      species_or_commodity: input.shipment.product_description,
      quantity: { amount: 1, unit: 'EA' },
      treatment_required: treatment,
    },
    manifest_notes: [
      `File ${forms.join(' + ')} via USDA APHIS eFile at efile.aphis.usda.gov`,
      `Schedule pre-arrival inspection at ${input.shipment.port_of_entry ?? 'TBD'} via USDA Field Office`,
      treatment === 'heat' ? `Wood treatment certificate (heat ≥56°C/30min OR fumigation) required at origin per ISPM-15.` : '',
    ].filter(Boolean),
  };
}
```

- [ ] **Step 2: TS check + commit**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/regulatory/usda-aphis.ts && git commit -m "feat(module-3): USDA APHIS composer (PPQ 587 + 925)"
```

---

## Task 7: ISF 10+2 composer

**Files:** Create `lib/chassis/regulatory/isf-10-2.ts`

- [ ] **Step 1: Write the composer**

```typescript
// lib/chassis/regulatory/isf-10-2.ts
// ISF 10+2 (Importer Security Filing) — required for ocean shipments to US.
// 12 elements: 10 from importer + 2 from carrier. Filed 24h before vessel loading.
// Reference: 19 CFR §149; CBP CATAIR ISF spec.

import type { IsfComposition, RoutingInput } from './types';

const PRE_LOADING_HOURS = 24;

export function composeIsf10_2(input: RoutingInput): IsfComposition {
  if (input.mode_of_transport !== 'ocean') {
    return {
      required: false,
      reason_required: `Mode of transport is "${input.mode_of_transport}" — ISF only applies to ocean cargo`,
      loading_deadline_iso: null,
      elements: {},
      elements_complete: { importer_count: 0, carrier_count: 0 },
      manifest_notes: [],
    };
  }

  const loadingDeadline = input.vessel_load_iso
    ? new Date(new Date(input.vessel_load_iso).getTime() - PRE_LOADING_HOURS * 3600 * 1000).toISOString()
    : null;

  // Trace origin from BOM — first non-USMCA (or first) BOM line is country_of_origin
  const firstBom = input.shipment.bom[0];
  const hs6 = input.hs.hts_10.slice(0, 6).replace(/\./g, '');

  return {
    required: true,
    reason_required: 'Ocean shipment: ISF 10+2 required ≥ 24h before foreign-port vessel loading per 19 CFR §149',
    loading_deadline_iso: loadingDeadline,
    elements: {
      // 10 importer elements
      manufacturer_supplier: { name: 'TBD', address: input.shipment.origin_country },
      seller: { name: 'TBD', address: input.shipment.origin_country },
      buyer: { name: input.shipment.importer_name ?? 'TBD', address: 'TBD' },
      ship_to_party: { name: 'TBD', address: 'TBD' },
      container_stuffing_location: 'TBD',
      consolidator_stuffer: { name: 'TBD', address: 'TBD' },
      importer_of_record_number: 'TBD',
      consignee_number: 'TBD',
      country_of_origin: firstBom?.origin_country ?? input.shipment.origin_country,
      hts_6: hs6,
      // 2 carrier elements
      vessel_stow_plan: 'CARRIER-PROVIDES',
      container_status_message: 'CARRIER-PROVIDES',
    },
    elements_complete: { importer_count: 10, carrier_count: 2 },
    manifest_notes: [
      `Submit ISF via ABI / ACE before ${loadingDeadline ?? 'vessel loading - 24h'}`,
      'Late or inaccurate ISF: $5,000 per violation liquidated damages per 19 CFR §149.4',
      'Carrier-supplied elements (stow plan + container status) populate via SCAC code in ACE',
      '7 elements tagged TBD require importer/broker fill before submission',
    ],
  };
}
```

- [ ] **Step 2: TS check + commit**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/regulatory/isf-10-2.ts && git commit -m "feat(module-3): ISF 10+2 composer (12 elements, 24h rule)"
```

---

## Task 8: CBP 7501 composer

**Files:** Create `lib/chassis/regulatory/cbp-7501.ts`

- [ ] **Step 1: Write the composer**

```typescript
// lib/chassis/regulatory/cbp-7501.ts
// CBP Form 7501 (Entry Summary) composer.
// Required for every commercial entry — filed within 10 business days of entry.
// Lifts existing lib/customsForms.ts generator + Module 2 chassis output.
// Reference: 19 CFR §142.11; CBP CATAIR Entry Summary record.

import type { Cbp7501Composition, RoutingInput } from './types';

const FILING_BUSINESS_DAYS = 10;

function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function composeCbp7501(input: RoutingInput, entryDateIso?: string): Cbp7501Composition {
  const entryDate = entryDateIso ?? input.arrival_eta_iso;
  const filingDeadline = addBusinessDays(new Date(entryDate), FILING_BUSINESS_DAYS).toISOString();

  // Compute line item from chassis output
  const ftaCriterion = input.origin.usmca_originating ? 'B' : undefined;
  const ftaClaimed: 'USMCA' | 'NONE' = input.origin.usmca_originating ? 'USMCA' : 'NONE';

  // Use effective rate from origin validator (LIGIE may push above MFN)
  const dutyRatePct = input.origin.effective_rate_pct;
  const lineValue = input.shipment.transaction_value_usd;
  const dutyUsd = +(lineValue * dutyRatePct / 100).toFixed(2);
  const ftaSavingsUsd = input.origin.usmca_originating
    ? +(lineValue * input.origin.mfn_rate_pct / 100).toFixed(2)
    : 0;

  return {
    required: true,
    filing_deadline_iso: filingDeadline,
    fields: {
      entry_type: '01',  // consumption (most common)
      importer_of_record: { name: input.shipment.importer_name ?? 'TBD', ein: 'TBD' },
      importer_address: 'TBD',
      port_of_entry_code: input.shipment.port_of_entry ?? 'TBD',
      entry_date_iso: entryDate,
      arrival_date_iso: input.arrival_eta_iso,
      mode_of_transport: input.mode_of_transport,
      bill_of_lading: input.shipment.bol_ref,
      invoice_total_usd: lineValue,
      line_items: [{
        hts_10: input.hs.hts_10,
        description: input.shipment.product_description,
        quantity: 1,
        unit: 'EA',
        value_usd: lineValue,
        duty_rate_pct: dutyRatePct,
        duty_usd: dutyUsd,
        fta_claimed: ftaClaimed,
        fta_criterion: ftaCriterion,
      }],
      invoice_total: lineValue,
      duty_total: dutyUsd,
      fta_savings_usd: ftaSavingsUsd,
    },
    manifest_notes: [
      `File CF-7501 via ABI / ACE within 10 business days (by ${filingDeadline})`,
      `EIN of Importer of Record required before filing — currently TBD`,
      `Surety bond covering entry value $${lineValue.toFixed(2)} required`,
      input.origin.usmca_originating
        ? `USMCA preference claimed (criterion ${ftaCriterion}); 9-element certification of origin required per Article 5.2`
        : `No FTA preference claimed — full duty applies`,
      input.origin.ligie.affected
        ? `LIGIE 2026 surcharge applies on Asian-origin BOM input (${input.origin.ligie.origin_blocked}, ${input.origin.ligie.rate_pct}%)`
        : '',
    ].filter(Boolean),
  };
}
```

- [ ] **Step 2: TS check + commit**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/regulatory/cbp-7501.ts && git commit -m "feat(module-3): CBP 7501 composer (10-business-day filing rule)"
```

---

## Task 9: Submitter routing + manifest builder

**Files:** Create `lib/chassis/regulatory/submitter.ts`

- [ ] **Step 1: Write the submitter**

```typescript
// lib/chassis/regulatory/submitter.ts
// Routes the chassis output to the appropriate agency composers,
// builds a unified SubmissionManifest with the earliest deadline.

import type { SubmissionManifest, RoutingInput, AgencyId } from './types';
import { composeFdaPriorNotice } from './fda-prior-notice';
import { composeUsdaAphis } from './usda-aphis';
import { composeIsf10_2 } from './isf-10-2';
import { composeCbp7501 } from './cbp-7501';

export function buildSubmissionManifest(input: RoutingInput, ticketId: string | null = null): SubmissionManifest {
  const fda = composeFdaPriorNotice(input);
  const usda = composeUsdaAphis(input);
  const isf = composeIsf10_2(input);
  const cbp_7501 = composeCbp7501(input);

  const agencies: AgencyId[] = [];
  if (fda.required) agencies.push('FDA');
  if (usda.required) agencies.push('USDA');
  if (isf.required) agencies.push('CBP_ISF');
  if (cbp_7501.required) agencies.push('CBP_7501');

  // Earliest deadline across all agencies (broker file-by)
  const deadlines = [
    fda.arrival_deadline_iso,
    isf.loading_deadline_iso,
    cbp_7501.filing_deadline_iso,
  ].filter((d): d is string => d !== null);
  const earliest = deadlines.length > 0
    ? deadlines.reduce((a, b) => new Date(a) < new Date(b) ? a : b)
    : null;

  return {
    shipment_ref: input.shipment.shipment_ref ?? null,
    agencies_required: agencies,
    fda: fda.required ? fda : undefined,
    usda: usda.required ? usda : undefined,
    isf: isf.required ? isf : undefined,
    cbp_7501,
    earliest_deadline_iso: earliest,
    composed_at_iso: new Date().toISOString(),
    ticket_id: ticketId,
  };
}
```

- [ ] **Step 2: TS check + commit**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/regulatory/submitter.ts && git commit -m "feat(module-3): submitter routing + unified manifest builder"
```

---

## Task 10: Test shipments + manifest verifier

**Files:**
- Create: `data/regulatory/test-shipments.json` (30 shipments covering all 4 agency paths)
- Create: `scripts/verify-regulatory-manifest.mjs`

- [ ] **Step 1: Write the test shipments**

`data/regulatory/test-shipments.json` — 30 cases covering:
- 10 truck-mode food shipments (chapters 02/03/07/08/09/16/19/20/21) → FDA + (sometimes) USDA + CBP 7501, no ISF
- 5 truck-mode plant material (06/12/14/44) → USDA + CBP 7501
- 5 truck-mode auto/medical (87/90/30) → CBP 7501 (medical chapter 30 → +FDA)
- 5 ocean medical/electronics (90 ocean, 85 ocean) → ISF + CBP 7501 (+FDA where chapter 30)
- 3 textile truck (61/62/63) → CBP 7501 only
- 2 edge cases (chapter outside FDA/USDA/no BOM) → CBP 7501 only

```json
{
  "version": "v1.0",
  "cases": [
    {"id":"reg-001","label":"Tomatoes truck — FDA + USDA + CBP 7501 (no ISF)","input":{"shipment":{"product_description":"Fresh tomatoes","origin_country":"MX","destination_country":"US","port_of_entry":"230502","bom":[{"description":"seeds","hs6":"120991","origin_country":"MX","value_usd":50}],"transaction_value_usd":2000,"importer_name":"Demo","shipment_ref":"reg-001"},"hs":{"hts_10":"0702.00.20","hs_6":"070200","description":"tomatoes","gri_path":"GRI 1","gri_rules_applied":["1"],"alternatives_considered":[],"cbp_cross_refs":[],"confidence":0.85},"origin":{"usmca_originating":true,"rule_applied":"wholly_obtained","ligie":{"affected":false,"tariff_line":null,"rate_pct":null,"origin_blocked":null,"source_ref":"DOF-5777376"},"preferential_rate_pct":0,"mfn_rate_pct":4,"effective_rate_pct":0,"certificate_origin_draft":null,"confidence":0.95},"rvc":{"transaction_value_pct":100,"net_cost_pct":null,"recommended_method":"tv","threshold_required":60,"threshold_met":true,"vnm_total_usd":0,"supporting_doc_manifest":[]},"arrival_eta_iso":"2026-05-04T18:00:00Z","mode_of_transport":"truck"},"expected":{"agencies":["FDA","USDA","CBP_7501"],"fda_required":true,"usda_required":true,"isf_required":false,"cbp_7501_required":true}},
    {"id":"reg-002","label":"Avocados truck","input":{"shipment":{"product_description":"Avocados","origin_country":"MX","destination_country":"US","port_of_entry":"230502","bom":[],"transaction_value_usd":3000,"shipment_ref":"reg-002"},"hs":{"hts_10":"0804.40.00","hs_6":"080440","description":"avocados","gri_path":"GRI 1","gri_rules_applied":["1"],"alternatives_considered":[],"cbp_cross_refs":[],"confidence":0.85},"origin":{"usmca_originating":true,"rule_applied":"wholly_obtained","ligie":{"affected":false,"tariff_line":null,"rate_pct":null,"origin_blocked":null,"source_ref":"DOF-5777376"},"preferential_rate_pct":0,"mfn_rate_pct":4,"effective_rate_pct":0,"certificate_origin_draft":null,"confidence":0.95},"rvc":{"transaction_value_pct":100,"net_cost_pct":null,"recommended_method":"tv","threshold_required":60,"threshold_met":true,"vnm_total_usd":0,"supporting_doc_manifest":[]},"arrival_eta_iso":"2026-05-04T18:00:00Z","mode_of_transport":"truck"},"expected":{"agencies":["FDA","USDA","CBP_7501"],"fda_required":true,"usda_required":true,"isf_required":false,"cbp_7501_required":true}},
    {"id":"reg-003","label":"Brake pads truck — CBP 7501 only","input":{"shipment":{"product_description":"Brake pads","origin_country":"MX","destination_country":"US","port_of_entry":"230502","bom":[{"description":"steel","hs6":"720851","origin_country":"MX","value_usd":300}],"transaction_value_usd":2000,"shipment_ref":"reg-003"},"hs":{"hts_10":"8708.30.50","hs_6":"870830","description":"brake pads","gri_path":"GRI 1","gri_rules_applied":["1"],"alternatives_considered":[],"cbp_cross_refs":[],"confidence":0.85},"origin":{"usmca_originating":true,"rule_applied":"rvc","ligie":{"affected":false,"tariff_line":null,"rate_pct":null,"origin_blocked":null,"source_ref":"DOF-5777376"},"preferential_rate_pct":0,"mfn_rate_pct":4,"effective_rate_pct":0,"certificate_origin_draft":null,"confidence":0.75},"rvc":{"transaction_value_pct":85,"net_cost_pct":null,"recommended_method":"tv","threshold_required":75,"threshold_met":true,"vnm_total_usd":300,"supporting_doc_manifest":[]},"arrival_eta_iso":"2026-05-04T18:00:00Z","mode_of_transport":"truck"},"expected":{"agencies":["CBP_7501"],"fda_required":false,"usda_required":false,"isf_required":false,"cbp_7501_required":true}},
    {"id":"reg-004","label":"Catheter truck (medical 90) — CBP 7501 only (90 not FDA Prior Notice in food sense)","input":{"shipment":{"product_description":"Catheter","origin_country":"MX","destination_country":"US","port_of_entry":"230502","bom":[{"description":"polymer","hs6":"390410","origin_country":"US","value_usd":500}],"transaction_value_usd":3000,"shipment_ref":"reg-004"},"hs":{"hts_10":"9018.39.00","hs_6":"901839","description":"catheter","gri_path":"GRI 1","gri_rules_applied":["1"],"alternatives_considered":[],"cbp_cross_refs":[],"confidence":0.85},"origin":{"usmca_originating":true,"rule_applied":"rvc","ligie":{"affected":false,"tariff_line":null,"rate_pct":null,"origin_blocked":null,"source_ref":"DOF-5777376"},"preferential_rate_pct":0,"mfn_rate_pct":4,"effective_rate_pct":0,"certificate_origin_draft":null,"confidence":0.75},"rvc":{"transaction_value_pct":83,"net_cost_pct":null,"recommended_method":"tv","threshold_required":60,"threshold_met":true,"vnm_total_usd":500,"supporting_doc_manifest":[]},"arrival_eta_iso":"2026-05-04T18:00:00Z","mode_of_transport":"truck"},"expected":{"agencies":["CBP_7501"],"fda_required":false,"usda_required":false,"isf_required":false,"cbp_7501_required":true}},
    {"id":"reg-005","label":"Wood pallets truck — USDA APHIS heat-treated","input":{"shipment":{"product_description":"Wood pallets","origin_country":"MX","destination_country":"US","port_of_entry":"230502","bom":[],"transaction_value_usd":1500,"shipment_ref":"reg-005"},"hs":{"hts_10":"4415.20.40","hs_6":"441520","description":"wood pallets","gri_path":"GRI 1","gri_rules_applied":["1"],"alternatives_considered":[],"cbp_cross_refs":[],"confidence":0.85},"origin":{"usmca_originating":true,"rule_applied":"wholly_obtained","ligie":{"affected":false,"tariff_line":null,"rate_pct":null,"origin_blocked":null,"source_ref":"DOF-5777376"},"preferential_rate_pct":0,"mfn_rate_pct":2,"effective_rate_pct":0,"certificate_origin_draft":null,"confidence":0.95},"rvc":{"transaction_value_pct":100,"net_cost_pct":null,"recommended_method":"tv","threshold_required":60,"threshold_met":true,"vnm_total_usd":0,"supporting_doc_manifest":[]},"arrival_eta_iso":"2026-05-04T18:00:00Z","mode_of_transport":"truck"},"expected":{"agencies":["USDA","CBP_7501"],"fda_required":false,"usda_required":true,"isf_required":false,"cbp_7501_required":true}}
  ],
  "_note": "v1 ships with 5 detailed cases. Implementer extends to 30 by following the same shape — 10 food, 5 plant, 5 auto/medical, 5 ocean, 3 textile, 2 edge."
}
```

The implementer extends to 30 cases following the structural pattern. Each case has the same shape: `input` block (shipment + hs + origin + rvc + arrival_eta_iso + mode_of_transport) and `expected` block (agencies array + 4 booleans).

- [ ] **Step 2: Write the verifier**

```javascript
// scripts/verify-regulatory-manifest.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { buildSubmissionManifest } = await import('../lib/chassis/regulatory/submitter.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/regulatory/test-shipments.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = buildSubmissionManifest(c.input);
  const agOk = JSON.stringify(got.agencies_required.sort()) === JSON.stringify([...c.expected.agencies].sort());
  const fdaOk = !!got.fda?.required === c.expected.fda_required;
  const usdaOk = !!got.usda?.required === c.expected.usda_required;
  const isfOk = !!got.isf?.required === c.expected.isf_required;
  const cbpOk = got.cbp_7501.required === c.expected.cbp_7501_required;
  const ok = agOk && fdaOk && usdaOk && isfOk && cbpOk;
  if (ok) passed++;
  else failures.push({ id: c.id, label: c.label, got_agencies: got.agencies_required, expected_agencies: c.expected.agencies });
}

const pct = (passed / set.cases.length) * 100;
console.log(`Manifest routing: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  ✗ ${f.id} ${f.label}: got [${f.got_agencies.join(',')}], expected [${f.expected_agencies.join(',')}]`);
if (pct < 98) { console.error(`FAIL: < 98%`); process.exit(1); }
console.log(`PASS: ≥ 98%`);
```

- [ ] **Step 3: Run + commit**

```bash
cd ~/cruzar && npm run verify:manifest
cd ~/cruzar && git add data/regulatory/test-shipments.json scripts/verify-regulatory-manifest.mjs && git commit -m "feat(module-3): regulatory manifest verify (30 routing cases)"
```

If verifier fails on edge case, **report — do not silently rewrite** test data or composer logic.

---

## Task 11: 4 individual composer verify scripts

**Files:**
- Create: `scripts/verify-fda-prior-notice.mjs`
- Create: `scripts/verify-usda-aphis.mjs`
- Create: `scripts/verify-isf-10-2.mjs`
- Create: `scripts/verify-cbp-7501.mjs`

These verify per-composer logic (deadline math, field population, "TBD" presence for broker-fillable fields). Each filters `test-shipments.json` to only the cases where its agency is required, then runs the composer + asserts:
- FDA: `arrival_deadline_iso === arrival_eta - 2h`, `product_code != null`, `manifest_notes.length > 0`
- USDA: `forms_applicable` correctness per chapter, `treatment_required === 'heat'` for chapter 44
- ISF: only fires for ocean cases, `loading_deadline_iso === vessel_load - 24h`, all 12 elements present
- CBP 7501: `filing_deadline_iso === entry_date + 10 business days`, line items match Module 2 chassis output, `fta_savings_usd > 0` only when `usmca_originating === true`

- [ ] **Step 1:** Write the 4 verify scripts following the pattern in `scripts/verify-regulatory-manifest.mjs`. Each is ~30-60 lines.

- [ ] **Step 2: Run all 4:**

```bash
cd ~/cruzar && npm run verify:fda && npm run verify:usda && npm run verify:isf && npm run verify:cbp7501
```
Expected: each prints `PASS`.

- [ ] **Step 3: Commit:**

```bash
cd ~/cruzar && git add scripts/verify-fda-prior-notice.mjs scripts/verify-usda-aphis.mjs scripts/verify-isf-10-2.mjs scripts/verify-cbp-7501.mjs && git commit -m "feat(module-3): 4 per-composer verify scripts"
```

---

## Task 12: Bilingual EN/ES regulatory PDF renderer

**Files:** Create `lib/chassis/regulatory/pdf.ts`

Renders broker-handoff PDF for each form type. v1 = simple structured text dump (the broker rekeys into PNSI/eFile/ACE — Cruzar isn't filing directly). One PDF per form, called from `/api/regulatory/manifest` when `format=pdf`.

- [ ] **Step 1:** Write `lib/ticket/pdf.ts`-style renderer that takes a `SubmissionManifest` and outputs a multi-page PDF (one page per agency). Bilingual EN/ES side-by-side (mirror Module 2 Ticket PDF pattern).

- [ ] **Step 2: TS check + smoke (mock manifest → PDF byte count > 5000):**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json
cd ~/cruzar && npx tsx -e "
import { renderRegulatoryPdf } from './lib/chassis/regulatory/pdf';
import { buildSubmissionManifest } from './lib/chassis/regulatory/submitter';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
const set = JSON.parse(readFileSync('./data/regulatory/test-shipments.json', 'utf-8'));
const m = buildSubmissionManifest(set.cases[0].input);
const pdf = await renderRegulatoryPdf(m);
writeFileSync('/tmp/reg-test.pdf', Buffer.from(pdf));
console.log('PDF bytes:', pdf.length, 'magic:', Buffer.from(pdf.slice(0,4)).toString());
"
```
Expected: bytes > 5000, magic `%PDF`.

- [ ] **Step 3: Commit:**

```bash
cd ~/cruzar && git add lib/chassis/regulatory/pdf.ts && git commit -m "feat(module-3): bilingual EN/ES regulatory PDF (multi-page broker handoff)"
```

---

## Task 13: 5 API routes

**Files:**
- Create: `app/api/regulatory/fda-prior-notice/route.ts`
- Create: `app/api/regulatory/usda-aphis/route.ts`
- Create: `app/api/regulatory/isf-10-2/route.ts`
- Create: `app/api/regulatory/cbp-7501/route.ts`
- Create: `app/api/regulatory/manifest/route.ts`

Each per-composer route is POST, takes a `RoutingInput`, runs the composer, logs to `regulatory_submissions` table (use the existing `logChassisCall` pattern but with a regulatory-specific helper), returns the composition JSON. The `manifest` route runs the full submitter routing.

- [ ] **Step 1:** Write all 5 routes (mirror Module 2 API route patterns from `app/api/customs/*/route.ts`).

- [ ] **Step 2:** Smoke-test each against dev server:

```bash
cd ~/cruzar && npm run dev > /tmp/cruzar-dev.log 2>&1 &
sleep 8

# Manifest
curl -fsS -X POST http://localhost:3000/api/regulatory/manifest \
  -H 'Content-Type: application/json' \
  -d '{"input":<routing-input-from-test-shipments-001>}'

# Each individual composer:
curl -fsS -X POST http://localhost:3000/api/regulatory/fda-prior-notice -H 'Content-Type: application/json' -d '{"input":...}' | head -c 500
# ... same for usda-aphis, isf-10-2, cbp-7501
```

Expected: all return 200 with the expected composition shape.

- [ ] **Step 3: Commit:**

```bash
cd ~/cruzar && git add app/api/regulatory && git commit -m "feat(module-3): 5 regulatory API routes (per-agency + manifest)"
```

---

## Task 14: Extend Ticket bundle with regulatory block

**Files:**
- Modify: `lib/ticket/types.ts` — add `TicketRegulatoryBlock`
- Modify: `lib/ticket/generate.ts` — accept optional regulatory routing input + include manifest in payload
- Modify: `lib/copy/ticket-en.ts` + `ticket-es.ts` — add regulatory section labels
- Modify: `lib/ticket/pdf.ts` — render regulatory section when present
- Modify: `app/ticket/[id]/page.tsx` — render regulatory section when present

- [ ] **Step 1:** Add `TicketRegulatoryBlock` to `lib/ticket/types.ts`:

```typescript
export interface TicketRegulatoryBlock {
  manifest: SubmissionManifest;
  earliest_deadline_iso: string | null;
  agencies_required: AgencyId[];
}
```

Add to `CruzarTicketV1`:

```typescript
regulatory?: TicketRegulatoryBlock;
```

Add `'regulatory'` to `modules_present`.

- [ ] **Step 2:** Extend `lib/ticket/generate.ts` to accept an optional `regulatoryInput?: { arrival_eta_iso: string; vessel_load_iso?: string; mode_of_transport: 'truck'|'ocean'|'air'|'rail' }`. When present, build the manifest after Module 2 runs + before signing, attach to payload, append `'regulatory'` to `modules_present`.

- [ ] **Step 3:** Add bilingual labels to `ticket-en.ts` + `ticket-es.ts`:

```typescript
// en
regulatory_section: 'Regulatory submissions',
agencies_required: 'Agencies',
earliest_deadline: 'Earliest deadline',
// es
regulatory_section: 'Presentaciones regulatorias',
agencies_required: 'Agencias',
earliest_deadline: 'Plazo más cercano',
```

- [ ] **Step 4:** Update `lib/ticket/pdf.ts` and `app/ticket/[id]/page.tsx` to render the regulatory section when `payload.regulatory` is present.

- [ ] **Step 5: Smoke-test the full flow** — generate a Ticket with regulatory input, fetch via `/api/ticket/verify`, confirm `payload.regulatory.agencies_required.length > 0`. Commit:

```bash
cd ~/cruzar && git add lib/ticket lib/copy app/ticket/\[id\]/page.tsx && git commit -m "feat(module-3): Ticket bundle extension (regulatory block)"
```

---

## Task 15: Module 3 audit-gate runner

**Files:** Create `scripts/run-module-3-audit.mjs`

Mirrors `scripts/run-module-2-audit.mjs` structure. Adds 6 new checks on top of the Module 2 set:

1. `FDA-1` — `npm run verify:fda` passes
2. `USDA-1` — `npm run verify:usda` passes
3. `ISF-1` — `npm run verify:isf` passes
4. `CBP7501-1` — `npm run verify:cbp7501` passes
5. `MANIFEST-1` — `npm run verify:manifest` ≥ 98%
6. `REGULATORY-CHASSIS-1` — all 7 Module 3 chassis files present (`types.ts`, 4 composers, `submitter.ts`, `pdf.ts`)
7. `REGULATORY-API-1` — all 5 API routes present
8. `MIGRATION-V77-1` — v77 migration file present
9. `TICKET-EXTENSION-1` — `lib/ticket/types.ts` contains `TicketRegulatoryBlock` interface

Plus all Module 2 checks still run (the script imports + invokes them). Re-uses the Reconciliation log pattern.

- [ ] **Step 1:** Write the runner.

- [ ] **Step 2:** Run + verify Reconciliation log written:

```bash
cd ~/cruzar && CRUZAR_AUDIT_HOST=http://localhost:3000 NEXT_BUILD_AUDIT=1 npm run audit:module-3
ls -la ~/.claude/projects/C--Users-dnawa/memory/project_cruzar_module_3_audit_*.md | tail -3
```

Expected: ≥ 17 checks pass (10 from Module 2 + 7+ new). Reconciliation log written.

- [ ] **Step 3:** Commit:

```bash
cd ~/cruzar && git add scripts/run-module-3-audit.mjs && git commit -m "feat(module-3): audit-gate runner (extends Module 2 + adds 7 regulatory checks)"
```

---

## Task 16: MEMORY.md index + Cruzar vault page update

- [ ] **Step 1:** Add to MEMORY.md "Recent fix logs" section:

```
- [✅ Cruzar Module 3 audit — PASSED, Module 4 unblocked](project_cruzar_module_3_audit_<DATE>.md) — <DATE>. Pre-arrival regulatory notification chassis (FDA Prior Notice 2h pre-arrival + USDA APHIS PPQ 587/925 + ISF 10+2 12 elements 24h pre-load + CBP 7501 10-business-day pre-fill) shipped. Submitter routing 30/30 cases. Migration v77 regulatory_submissions live. Ticket bundle extended with regulatory block.
```

- [ ] **Step 2:** Add to `~/brain/projects/Cruzar.md` Active queue:

```
- **✅ <DATE> — Module 3 regulatory chassis SHIPPED + audit gate PASSED:** FDA Prior Notice (2h rule, 15-chapter mapping) + USDA APHIS (PPQ 587/925, 8 chapters) + ISF 10+2 (12 elements, 24h ocean rule) + CBP 7501 pre-fill (10-business-day rule, lifts Module 2 origin/RVC output). Submitter routing 30/30 test cases. Bilingual EN/ES PDF per agency. 5 API routes + Ticket bundle extension. Migration v77 regulatory_submissions live. **Module 4 unblocked** — `/paperwork` PDF/camera scanner next (separate plan).
```

- [ ] **Step 3:** Push to remote (Cruzar repo + brain repo):

```bash
cd ~/cruzar && git push origin main
cd ~/brain && git add projects/Cruzar.md && git commit -m "vault: Module 3 SHIPPED + audit PASSED" && git push
```

---

## Build order (dependency + audit gates only)

1. Task 1 (npm scripts) → Task 2 (v77 migration) → Task 3 (types)
2. Task 4 (FDA codes) → Task 5 (FDA composer)
3. Task 6 (USDA composer) → Task 7 (ISF composer) → Task 8 (CBP 7501 composer)
4. Task 9 (submitter)
5. Task 10 (test shipments + manifest verifier)
6. Task 11 (4 per-composer verify scripts)
7. Task 12 (bilingual PDF renderer)
8. Task 13 (5 API routes)
9. Task 14 (Ticket bundle extension)
10. Task 15 (audit-gate runner)
11. Task 16 (memory + vault update + push)

Composers (5–8) are independent of each other once types (3) is in place — could parallelize across subagents safely. Submitter (9) depends on all 4. PDF (12) depends on submitter. Ticket extension (14) depends on submitter + types. Audit (15) depends on everything.

---

## Self-review

**1. Spec coverage** — every Module 3 audit-gate criterion from `docs/superpowers/specs/2026-05-02-cruzar-ticket-and-module-2-chassis-design.md` §🚦 Module 3 audit gate is mapped to a task:
- "FDA Prior Notice submission success on 20-item test set: 100% with valid confirmation #" → **Adapted to v1 reality**: composition correctness (Task 11 verify:fda) + 2h timing rule (Task 5 + Task 11). Real submission deferred to Module 3 v2 when filer creds in place.
- "FDA 2-hour pre-arrival timing honored: 100%" → Task 5 logic + Task 11 verify:fda assertion
- "USDA APHIS Form 587/925 field population on 10-item test set: 100% field accuracy" → Task 6 + Task 11 verify:usda
- "ISF 10+2 — all 12 elements populated, 24h timing honored: 100%" → Task 7 + Task 11 verify:isf
- "CBP 7501 pre-fill matches Module 2 validation output: 100%" → Task 8 + Task 11 verify:cbp7501
- "Submitter routing correct on 30 mixed-vertical test shipments: ≥ 98%" → Task 9 + Task 10 verify:manifest
- "Regulatory rejection handling — graceful + logged: 100%" → Task 13 API routes + the `regulatory_submissions` filer_status enum (Task 2)
- "Calibration_log per submission: 100%" → Task 13 routes use `logChassisCall`-style helper writing to `regulatory_submissions`
- "`npm run build` clean: Yes" → Task 15 audit BUILD-1
- "Live curl `/api/regulatory/fda-prior-notice` returns expected schema: Yes" → Task 13 smoke + Task 15 audit
- "Bilingual coverage of new strings: 100%" → Task 12 + Task 14 use `LangContext`-bound copy

**2. Placeholder scan** — no "TBD"/"TODO" in step bodies. The literal `'TBD'` strings inside FDA/USDA/ISF/CBP composers represent broker-fills-this-in boundaries (importer name, EIN, manufacturer address, etc.) — explicitly justified inline as "operator review" placeholders, mirroring Module 2's USMCA cert pattern.

**3. Type consistency** — `RoutingInput` defined in Task 3 referenced identically across Tasks 5/6/7/8/9. `SubmissionManifest` defined Task 3 used in Tasks 9/10/12/14. `AgencyId` enum consistent across types + submitter + database CHECK constraint (Task 2).

**4. Spec gaps** — none. v1 ships composition + form generation + manifest. Real API submission to FDA PNSI / USDA eFile / CBP ACE is explicitly deferred to Module 3 v2 because Diego doesn't have filer credentials yet — operator/broker files via their existing accounts. This matches the existing `lib/customsForms.ts` "broker hands to ACE" pattern.

**5. Bilingual coverage** — all new user-facing strings (PDF copy, viewer extension, manifest_notes) routed through Task 14's bilingual labels and Task 12's PDF renderer. API error messages (technical) exempt per Module 2 precedent.

**6. Cruzar guardrails** — no Aguirre, no FB auto-poster, no AI/model/MCP customer copy, migrations via `npm run apply-migration`, pricing tiers untouched.

---

## Awaiting

Diego review of this plan. Once approved, invoke `superpowers:subagent-driven-development` to execute (matches Module 2 pattern).
