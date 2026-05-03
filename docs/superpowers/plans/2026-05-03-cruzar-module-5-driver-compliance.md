# Cruzar Module 5 — Driver-Side Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the driver-side compliance chassis at `/insights/drivers` — broker enters driver record + shipment context, the chassis runs 5 checks (USMCA Annex 31-A labor obligations / IMSS contributions / HOS dual-regime / drug & alcohol testing / Borello drayage W-2 vs 1099) and emits a compliance manifest. Ticket bundle extends with `drivers` block; `modules_present: ['customs','regulatory','paperwork','drivers']` when broker provides driver input.

**Architecture:** v1 ships **deterministic rule-based checks + flag-with-disclaimer manifest** — NOT direct ELD integration, NOT legal opinion. Each check returns `compliant: boolean | 'flagged' | 'inconclusive'` + `reason: string` + `manifest_notes: string[]`. `'flagged'` means broker must review (e.g. RVC near threshold, drug test expiring soon). Disclaimer on every output: *"Operational classification only; consult labor counsel for binding determination."* Lifts the Mexican labor law engine pattern from the killed Laboral MX project — engine pattern preserved, applied here in Cruzar's freight context.

**Tech Stack:** Next.js 16 + TypeScript strict + Supabase. No new external deps — pure rule-engine code.

**Spec source:** `~/cruzar/docs/superpowers/specs/2026-05-02-cruzar-ticket-and-module-2-chassis-design.md` §Module 5.

**Scope:** Module 5 only. Module 6 (live dispatch map at `/dispatch/map`, queued by brain terminal 2026-05-03) gets a separate plan after Module 5 audit passes.

**Prerequisite:** Module 4 audit-gate PASSED 2026-05-03 — paperwork chassis + Ticket extension live; Module 4 audit reconciliation log says Module 5 unblocked.

---

## Pattern-learning reference (per `feedback_pattern_learning_from_mature_ecosystems_20260503`)

Module 5 design adopts **structural patterns** from the more-mature Canadian commercial-driver ecosystem WITHOUT importing Canadian data, numbers, or regime-specific assumptions:

| Adopted from Canada | Cruzar Module 5 application |
|---|---|
| **Canadian Federal HOS Regs dual-cycle structure** (Cycle 1 vs Cycle 2 with 24h reset eligibility) | `HosResult` exposes `cycle_reset_eligible: boolean` field so brokers can plan a 24h reset to clear US 70h/8d cycle violations. Numbers stay US (60/70) + MX (8/9) — only the *reset-eligibility concept* is Canadian-pattern-derived. |
| **Bill C-46 + provincial equivalency-table format** (per-substance mapping rows) | `drug-testing.ts` `manifest_notes` includes a structural equivalency note per panel (cocaine / opioids / amphetamine / cannabis / alcohol) → US-DOT-Part-40 ↔ MX-NOM-035-STPS-2018. Format-borrowed; substance specifics are US/MX, not Canadian. |
| **Canadian "personal services contract" sub-categorization** (W-2 / dependent contractor / true 1099) | Queued for Module 5.5 enrichment; v1 stays binary W-2 vs 1099 to keep audit-gate tight. |
| **CARM Release Prior to Payment workflow** (broker releases shipment *before* finalizing compliance docs) | Queued for Module 5.5 enrichment; v1 surfaces `flagged` overall_status + deadline guidance in manifest_notes. |

**Anti-patterns explicitly avoided per the principle:**
- ❌ Canadian Federal HOS numbers (10h driving / 13h on-duty) — different from US 11/14 + MX 8/9
- ❌ Canadian Workers' Comp / WSIB structures — not portable to IMSS context
- ❌ "Trust government data" assumption — MX-side data unreliability is Cruzar's wedge

---

## File map

**Create:**
- `lib/chassis/drivers/types.ts` — schemas
- `lib/chassis/drivers/usmca-annex-31a.ts` — facility-level labor obligations check
- `lib/chassis/drivers/imss.ts` — Mexican social security contribution status
- `lib/chassis/drivers/hos-divergence.ts` — Hours-of-Service dual-regime calculator (US DOT FMCSA vs Mexico SCT)
- `lib/chassis/drivers/drug-testing.ts` — DOT 49 CFR Part 40 + MX equivalency mapper
- `lib/chassis/drivers/drayage-1099.ts` — Borello test (11 factors) for W-2 vs 1099 classification
- `lib/chassis/drivers/composer.ts` — orchestrator
- `lib/calibration-drivers.ts` — logging helper
- `data/drivers/test-cases.json` — 25 known-answer cases across all 5 checks
- `app/api/drivers/usmca-annex-31a/route.ts`
- `app/api/drivers/imss/route.ts`
- `app/api/drivers/hos/route.ts`
- `app/api/drivers/drug-testing/route.ts`
- `app/api/drivers/drayage-classification/route.ts`
- `app/api/drivers/manifest/route.ts` — single endpoint runs all 5 checks
- `app/insights/drivers/page.tsx` — broker UI (server component)
- `app/insights/drivers/DriversClient.tsx` — interactive form
- `scripts/verify-hos-divergence.mjs`
- `scripts/verify-drayage-borello.mjs`
- `scripts/verify-drivers-manifest.mjs`
- `scripts/run-module-5-audit.mjs`
- `supabase/migrations/v79-driver-compliance.sql`

**Modify:**
- `lib/ticket/types.ts` — add `TicketDriversBlock`, extend `CruzarTicketV1`
- `lib/ticket/generate.ts` — accept optional `driversInput`
- `lib/copy/ticket-en.ts` + `ticket-es.ts` — drivers section labels
- `lib/ticket/pdf.ts` — render drivers section
- `app/ticket/[id]/page.tsx` — render drivers section
- `package.json` — add 3 verify scripts + `audit:module-5`

**Audit-gate output:** `~/.claude/projects/.../memory/project_cruzar_module_5_audit_<DATE>.md`

---

## Task 1: package.json verify scripts

**Files:** Modify `package.json`

- [ ] **Step 1:** Add 4 new npm scripts to the `scripts` block (after `audit:module-4`):

```json
"verify:hos": "npx tsx scripts/verify-hos-divergence.mjs",
"verify:drayage": "npx tsx scripts/verify-drayage-borello.mjs",
"verify:drivers": "npx tsx scripts/verify-drivers-manifest.mjs",
"audit:module-5": "node scripts/run-module-5-audit.mjs"
```

- [ ] **Step 2:** Verify:

```bash
cd ~/cruzar && node -e "
const p = require('./package.json');
const expected = ['verify:hos','verify:drayage','verify:drivers','audit:module-5'];
const missing = expected.filter(k => !(k in p.scripts));
console.log('total:', Object.keys(p.scripts).length, 'M5 missing:', missing);
"
```
Expected: `total: 25`, `M5 missing: []`.

- [ ] **Step 3:** Commit:

```bash
cd ~/cruzar && git add package.json && git commit -m "feat(module-5): add drivers verify + audit npm scripts"
```

---

## Task 2: Migration v79 — `driver_compliance`

**Files:** Create `supabase/migrations/v79-driver-compliance.sql`

- [ ] **Step 1:** Write the migration with this EXACT content:

```sql
-- v79: driver_compliance — Module 5 chassis log
-- One row per compliance check (USMCA Annex 31-A, IMSS, HOS, drug testing, drayage classification).

CREATE TABLE IF NOT EXISTS public.driver_compliance (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,                                -- nullable: check may run before Ticket signs
  shipment_ref TEXT,
  driver_ref TEXT,                               -- broker-supplied driver identifier (no PII required)
  check_type TEXT NOT NULL CHECK (check_type IN ('usmca_annex_31a','imss','hos','drug_testing','drayage_classification','manifest')),
  input_payload JSONB NOT NULL,
  output_payload JSONB NOT NULL,                 -- { compliant, reason, manifest_notes, ... }
  status TEXT NOT NULL CHECK (status IN ('compliant','non_compliant','flagged','inconclusive')),
  caller TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Calibration outcome (filled post-shipment by broker)
  outcome_confirmed BOOLEAN,
  outcome_recorded_at TIMESTAMPTZ,
  outcome_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_drv_check_type ON public.driver_compliance(check_type);
CREATE INDEX IF NOT EXISTS idx_drv_status ON public.driver_compliance(status);
CREATE INDEX IF NOT EXISTS idx_drv_created_at ON public.driver_compliance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drv_ticket ON public.driver_compliance(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drv_driver_ref ON public.driver_compliance(driver_ref) WHERE driver_ref IS NOT NULL;

ALTER TABLE public.driver_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access on driver_compliance"
  ON public.driver_compliance
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.driver_compliance IS 'Module 5 driver-side compliance check log. One row per check or manifest run. Status indicates broker action required: compliant=ok, flagged=review, non_compliant=block, inconclusive=needs more data. Outcome columns filled post-shipment for calibration.';
```

- [ ] **Step 2:** Apply:
```bash
cd ~/cruzar && npm run apply-migration -- supabase/migrations/v79-driver-compliance.sql
```
Expected: HTTP 201.

- [ ] **Step 3:** Verify table:
```bash
cd ~/cruzar && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('driver_compliance').select('id').limit(1).then(r => console.log(r.error?.message || 'OK'));
"
```

- [ ] **Step 4:** Commit:
```bash
cd ~/cruzar && git add supabase/migrations/v79-driver-compliance.sql && git commit -m "feat(module-5): migration v79 driver_compliance"
```

---

## Task 3: Module 5 chassis types

**Files:** Create `lib/chassis/drivers/types.ts`

- [ ] **Step 1:** `mkdir -p ~/cruzar/lib/chassis/drivers` then write the types file:

```typescript
// lib/chassis/drivers/types.ts
// Module 5 — driver-side compliance schemas.
// v1 = deterministic rule-based checks + flag-with-disclaimer manifest.
// NOT legal opinion. Disclaimer surfaces on every check output.

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'flagged' | 'inconclusive';

export type CheckType =
  | 'usmca_annex_31a'
  | 'imss'
  | 'hos'
  | 'drug_testing'
  | 'drayage_classification';

// ── Driver record (broker-supplied) ─────────────────────────────────────────
export interface DriverRecord {
  driver_ref: string;                           // broker-supplied identifier (no PII required)
  primary_jurisdiction: 'US' | 'MX' | 'BOTH';   // where the driver normally operates
  cdl_class?: 'A' | 'B' | 'C';
  imss_active?: boolean;                        // for MX-side drivers
  imss_last_payment_iso?: string;               // ISO date of last contribution payment
  last_drug_test_iso?: string;                  // ISO date
  last_drug_test_jurisdiction?: 'US_DOT' | 'MX_SCT' | 'BOTH';
  employment_classification?: 'W2' | '1099' | 'unknown';
  // Borello-test inputs (employment-classification factors)
  uses_own_truck?: boolean;
  sets_own_schedule?: boolean;
  works_for_other_carriers?: boolean;
  carries_independent_business_expenses?: boolean;
  paid_per_mile?: boolean;
  paid_hourly?: boolean;
  has_own_dot_authority?: boolean;
}

// ── HOS log entry ───────────────────────────────────────────────────────────
export interface HosLogEntry {
  date_iso: string;
  driving_hours: number;                        // hours actually driving
  on_duty_hours: number;                        // including non-driving on-duty time
  rest_hours_prior: number;                     // consecutive off-duty hours immediately before this duty period
  cycle_hours_last_7_or_8_days: number;         // accumulated on-duty hours in trailing 7/8-day window
}

// ── Per-check results ──────────────────────────────────────────────────────
export interface UsmcaAnnex31AResult {
  compliant: ComplianceStatus;
  reason: string;
  facility_attestation_present: boolean;
  collective_bargaining_compliant: boolean;
  manifest_notes: string[];
}

export interface ImssResult {
  compliant: ComplianceStatus;
  reason: string;
  days_since_last_payment: number | null;
  payment_status: 'current' | 'lapsed_30' | 'lapsed_60_plus' | 'unknown' | 'not_applicable';
  manifest_notes: string[];
}

export interface HosResult {
  compliant: ComplianceStatus;
  reason: string;
  us_dot: {
    within_11h_driving: boolean;
    within_14h_on_duty: boolean;
    within_70h_8day_cycle: boolean;
    rest_break_required: boolean;               // 30-min after 8h driving
    cycle_reset_eligible: boolean;              // true when 34h consecutive off-duty would clear the 70h cycle violation (49 CFR §395.3(c) restart provision)
  };
  mx_sct: {
    within_8h_driving: boolean;
    within_9h_on_duty: boolean;
    within_14h_rest_break_compliance: boolean;
  };
  divergence_flag: boolean;                     // true when US-clean but MX-foul, or vice versa
  manifest_notes: string[];
}

export interface DrugTestingResult {
  compliant: ComplianceStatus;
  reason: string;
  days_since_last_test: number | null;
  test_currency: 'current' | 'expiring_soon' | 'expired' | 'unknown';
  jurisdiction_match: boolean;                  // does driver's tested jurisdiction match shipment route
  equivalency_required: boolean;                // true when MX-only test on US-bound shipment, etc.
  manifest_notes: string[];
}

export interface DrayageClassificationResult {
  compliant: ComplianceStatus;
  reason: string;
  borello_score: number;                        // 0-11 (factors weighing toward 1099)
  classification_recommendation: 'W2' | '1099' | 'borderline_review';
  declared_classification: 'W2' | '1099' | 'unknown';
  classification_match: boolean;                // does declared match recommendation?
  paga_risk_estimate_usd: number;               // rough $ exposure if misclassified
  manifest_notes: string[];
}

// ── Composer / manifest ─────────────────────────────────────────────────────
export interface DriverComplianceInput {
  driver: DriverRecord;
  shipment_ref: string | null;
  shipment_route: 'US_only' | 'MX_only' | 'cross_border';   // where the freight is going
  hos_log?: HosLogEntry;                         // optional; required for HOS check
  facility_attestation_uploaded?: boolean;       // for USMCA 31-A
}

export interface DriverComplianceManifest {
  driver_ref: string;
  shipment_ref: string | null;
  checks_run: CheckType[];
  usmca_annex_31a?: UsmcaAnnex31AResult;
  imss?: ImssResult;
  hos?: HosResult;
  drug_testing?: DrugTestingResult;
  drayage_classification?: DrayageClassificationResult;
  overall_status: ComplianceStatus;              // worst of the per-check statuses
  blocking_issues: string[];
  composed_at_iso: string;
  ticket_id: string | null;
  disclaimer: string;                            // always present
}
```

- [ ] **Step 2:** TS check + commit:

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/drivers/types.ts && git commit -m "feat(module-5): drivers chassis types (DriverRecord, 5 check results, manifest)"
```

---

## Task 4: USMCA Annex 31-A check

**Files:** Create `lib/chassis/drivers/usmca-annex-31a.ts`

USMCA Annex 31-A requires Mexican facility-level compliance with collective bargaining + freedom of association rules. Broker-side relevant when validating maquila supplier compliance. v1 = simple attestation check (broker uploads/affirms facility compliance certificate); v2 will integrate STPS data feed.

- [ ] **Step 1:** Write the check:

```typescript
// lib/chassis/drivers/usmca-annex-31a.ts
// USMCA Annex 31-A — Mexican facility labor obligations.
// v1: attestation-based (broker affirms facility compliance certificate is on file).
// v2: STPS data feed integration.

import type { UsmcaAnnex31AResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

export function checkUsmcaAnnex31A(input: DriverComplianceInput): UsmcaAnnex31AResult {
  // Only relevant for shipments touching MX side (cross-border or MX_only)
  if (input.shipment_route === 'US_only') {
    return {
      compliant: 'compliant',
      reason: 'US-only shipment — USMCA Annex 31-A not applicable to MX facility',
      facility_attestation_present: false,
      collective_bargaining_compliant: true,
      manifest_notes: [],
    };
  }

  const attestation = !!input.facility_attestation_uploaded;
  if (!attestation) {
    return {
      compliant: 'flagged',
      reason: 'No facility attestation on file — USMCA Annex 31-A requires written compliance affirmation',
      facility_attestation_present: false,
      collective_bargaining_compliant: false,
      manifest_notes: [
        'Upload signed facility compliance certificate (collective bargaining + freedom of association per USMCA Annex 31-A)',
        'STPS-recognized union election + CBA filing required by 1 May 2024 reform deadline',
        DISCLAIMER,
      ],
    };
  }

  return {
    compliant: 'compliant',
    reason: 'Facility attestation on file; USMCA Annex 31-A obligations affirmed',
    facility_attestation_present: true,
    collective_bargaining_compliant: true,
    manifest_notes: [
      'Verify attestation date is within 12 months for annual renewal',
      'Cross-check facility name against STPS union registry (manual broker action)',
      DISCLAIMER,
    ],
  };
}
```

- [ ] **Step 2:** TS check + commit:

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/drivers/usmca-annex-31a.ts && git commit -m "feat(module-5): USMCA Annex 31-A check (facility attestation v1)"
```

---

## Task 5: IMSS contribution status check

**Files:** Create `lib/chassis/drivers/imss.ts`

Mexican social-security check. v1 = days-since-last-payment heuristic. v2 = direct IMSS web service.

- [ ] **Step 1:** Write the check:

```typescript
// lib/chassis/drivers/imss.ts
// IMSS (Instituto Mexicano del Seguro Social) contribution status check.
// v1: days-since-last-payment heuristic against broker-supplied driver record.
// v2: direct IMSS web service / API integration.

import type { ImssResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

const LAPSED_30_DAYS = 30;
const LAPSED_60_DAYS = 60;

function daysBetween(a: string, b: string): number {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.floor(ms / (24 * 3600 * 1000));
}

export function checkImss(input: DriverComplianceInput): ImssResult {
  const driver = input.driver;

  // Not applicable for US-only drivers on US-only shipments
  if (driver.primary_jurisdiction === 'US' && input.shipment_route === 'US_only') {
    return {
      compliant: 'compliant',
      reason: 'US-only driver on US-only shipment — IMSS not applicable',
      days_since_last_payment: null,
      payment_status: 'not_applicable',
      manifest_notes: [],
    };
  }

  // For MX-side drivers, IMSS coverage is required
  if (driver.imss_active === false) {
    return {
      compliant: 'non_compliant',
      reason: 'Driver IMSS coverage marked inactive — Mexican social-security obligation unmet',
      days_since_last_payment: null,
      payment_status: 'lapsed_60_plus',
      manifest_notes: [
        'Driver must have IMSS coverage for cross-border or MX-only shipments per Mexican Federal Labor Law',
        'Reactivate IMSS via patron registration before driver re-engages on this lane',
        DISCLAIMER,
      ],
    };
  }

  if (driver.imss_active === undefined) {
    return {
      compliant: 'inconclusive',
      reason: 'IMSS coverage status unknown — broker must affirm before clearance',
      days_since_last_payment: null,
      payment_status: 'unknown',
      manifest_notes: [
        'Mark imss_active=true|false in driver record before re-running the check',
        DISCLAIMER,
      ],
    };
  }

  // imss_active === true — check last payment date
  if (!driver.imss_last_payment_iso) {
    return {
      compliant: 'flagged',
      reason: 'IMSS marked active but no last-payment date supplied',
      days_since_last_payment: null,
      payment_status: 'unknown',
      manifest_notes: [
        'Capture last IMSS contribution payment date for on-time-payment verification',
        DISCLAIMER,
      ],
    };
  }

  const daysSince = daysBetween(new Date().toISOString(), driver.imss_last_payment_iso);
  if (daysSince <= LAPSED_30_DAYS) {
    return {
      compliant: 'compliant',
      reason: `Last IMSS payment ${daysSince}d ago — current`,
      days_since_last_payment: daysSince,
      payment_status: 'current',
      manifest_notes: [DISCLAIMER],
    };
  }
  if (daysSince <= LAPSED_60_DAYS) {
    return {
      compliant: 'flagged',
      reason: `Last IMSS payment ${daysSince}d ago — lapsed 30-60d, broker review required`,
      days_since_last_payment: daysSince,
      payment_status: 'lapsed_30',
      manifest_notes: [
        'Confirm next IMSS payment scheduled within 30 days; otherwise driver coverage may lapse mid-shipment',
        DISCLAIMER,
      ],
    };
  }
  return {
    compliant: 'non_compliant',
    reason: `Last IMSS payment ${daysSince}d ago — lapsed >60d, coverage likely terminated`,
    days_since_last_payment: daysSince,
    payment_status: 'lapsed_60_plus',
    manifest_notes: [
      'IMSS coverage almost certainly terminated; reactivate before driver re-engages',
      'Driver injury during shipment with lapsed IMSS = direct broker liability for medical + indemnification per LFT Articles 53/54',
      DISCLAIMER,
    ],
  };
}
```

- [ ] **Step 2:** TS check + commit:

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/drivers/imss.ts && git commit -m "feat(module-5): IMSS contribution status check (days-since-payment heuristic)"
```

---

## Task 6: HOS dual-regime calculator

**Files:** Create `lib/chassis/drivers/hos-divergence.ts`

The trickiest math piece. US DOT FMCSA HOS rules (49 CFR §395) differ from Mexican SCT rules. Driver crossing border = both regimes potentially apply.

US DOT rules:
- 11h driving max within 14h on-duty window
- 30-min break required after 8h driving
- 60h/7d or 70h/8d cycle limit

Mexican SCT rules (per the *Reglamento de Tránsito en Carreteras y Puentes de Jurisdicción Federal* and STPS labor law):
- 8h driving max
- 9h on-duty max
- 14h continuous rest break required between shifts

- [ ] **Step 1:** Write the calculator:

```typescript
// lib/chassis/drivers/hos-divergence.ts
// Hours-of-Service dual-regime calculator.
// US DOT FMCSA: 49 CFR §395 — 11h driving / 14h on-duty / 60-70h cycle / 30-min break after 8h.
// Mexican SCT: 8h driving / 9h on-duty / 14h continuous rest between shifts.
// "Divergence flag" fires when one regime passes but the other fails.

import type { HosResult, HosLogEntry, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

// US DOT FMCSA limits
const US_MAX_DRIVING = 11;
const US_MAX_ON_DUTY = 14;
const US_MAX_8DAY_CYCLE = 70;
const US_BREAK_REQUIRED_AFTER = 8;

// Mexican SCT limits
const MX_MAX_DRIVING = 8;
const MX_MAX_ON_DUTY = 9;
const MX_MIN_REST_BETWEEN = 14;

export function checkHos(input: DriverComplianceInput): HosResult {
  const log = input.hos_log;

  if (!log) {
    return {
      compliant: 'inconclusive',
      reason: 'No HOS log supplied — driver duty/rest data required for compliance check',
      us_dot: { within_11h_driving: false, within_14h_on_duty: false, within_70h_8day_cycle: false, rest_break_required: false },
      mx_sct: { within_8h_driving: false, within_9h_on_duty: false, within_14h_rest_break_compliance: false },
      divergence_flag: false,
      manifest_notes: [
        'Capture driver HOS log (driving_hours, on_duty_hours, rest_hours_prior, cycle_hours_last_7_or_8_days) and re-run',
        DISCLAIMER,
      ],
    };
  }

  // US DOT checks
  const within11hDriving = log.driving_hours <= US_MAX_DRIVING;
  const within14hOnDuty = log.on_duty_hours <= US_MAX_ON_DUTY;
  const within70h8day = log.cycle_hours_last_7_or_8_days <= US_MAX_8DAY_CYCLE;
  const breakRequired = log.driving_hours > US_BREAK_REQUIRED_AFTER;
  const usClean = within11hDriving && within14hOnDuty && within70h8day;
  // 34h consecutive off-duty restart (49 CFR §395.3(c)) — eligible when cycle is over but driver could clear it via reset
  const cycleResetEligible = !within70h8day && log.rest_hours_prior < 34;

  // MX SCT checks
  const within8hDriving = log.driving_hours <= MX_MAX_DRIVING;
  const within9hOnDuty = log.on_duty_hours <= MX_MAX_ON_DUTY;
  const within14hRest = log.rest_hours_prior >= MX_MIN_REST_BETWEEN;
  const mxClean = within8hDriving && within9hOnDuty && within14hRest;

  const divergence = (input.shipment_route !== 'US_only' && input.shipment_route !== 'MX_only')
    ? (usClean !== mxClean)
    : false;

  // Determine relevant regime + status
  let compliant: HosResult['compliant'];
  let reason: string;
  const notes: string[] = [];

  if (input.shipment_route === 'US_only') {
    compliant = usClean ? 'compliant' : 'non_compliant';
    reason = usClean
      ? `US DOT HOS clean (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.cycle_hours_last_7_or_8_days}h cycle)`
      : `US DOT HOS violation (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.cycle_hours_last_7_or_8_days}h cycle vs limits 11/14/70)`;
  } else if (input.shipment_route === 'MX_only') {
    compliant = mxClean ? 'compliant' : 'non_compliant';
    reason = mxClean
      ? `MX SCT HOS clean (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.rest_hours_prior}h rest prior)`
      : `MX SCT HOS violation (${log.driving_hours}h driving / ${log.on_duty_hours}h on-duty / ${log.rest_hours_prior}h rest vs limits 8/9/14)`;
  } else {
    // cross-border — must satisfy BOTH regimes
    if (usClean && mxClean) {
      compliant = 'compliant';
      reason = 'Both US DOT and MX SCT HOS limits satisfied';
    } else if (divergence) {
      compliant = 'flagged';
      reason = usClean
        ? `US DOT clean but MX SCT violation — driver enters MX side over Mexican limits (US 11h vs MX 8h driving cap)`
        : `MX SCT clean but US DOT violation — unusual; review log for accuracy`;
      notes.push('Cross-border shipment must satisfy stricter of the two regimes (typically MX 8h driving cap)');
    } else {
      compliant = 'non_compliant';
      reason = 'Both US DOT and MX SCT HOS limits violated';
    }
  }

  if (breakRequired) {
    notes.push(`Driver exceeded 8h driving (${log.driving_hours}h) — verify 30-min break taken per 49 CFR §395.3(a)(3)(ii)`);
  }
  if (cycleResetEligible) {
    notes.push(`70h/8d cycle exceeded — 34h consecutive off-duty restart per 49 CFR §395.3(c) would clear cycle. Schedule reset before next dispatch.`);
  }
  notes.push(DISCLAIMER);

  return {
    compliant,
    reason,
    us_dot: {
      within_11h_driving: within11hDriving,
      within_14h_on_duty: within14hOnDuty,
      within_70h_8day_cycle: within70h8day,
      rest_break_required: breakRequired,
      cycle_reset_eligible: cycleResetEligible,
    },
    mx_sct: {
      within_8h_driving: within8hDriving,
      within_9h_on_duty: within9hOnDuty,
      within_14h_rest_break_compliance: within14hRest,
    },
    divergence_flag: divergence,
    manifest_notes: notes,
  };
}
```

- [ ] **Step 2:** TS check + commit:

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/drivers/hos-divergence.ts && git commit -m "feat(module-5): HOS dual-regime calculator (US DOT FMCSA + MX SCT)"
```

---

## Task 7: Drug & alcohol testing check

**Files:** Create `lib/chassis/drivers/drug-testing.ts`

DOT 49 CFR Part 40 = US standard. MX equivalent (NOM-035-STPS-2018 + medical exam regimen) is approximately equivalent for some drug panels but NOT identical. Annual test currency + jurisdiction-match flag.

- [ ] **Step 1:** Write the check:

```typescript
// lib/chassis/drivers/drug-testing.ts
// DOT 49 CFR Part 40 + MX equivalency mapper.
// US: random + pre-employment + post-accident testing on 5-panel drug screen + alcohol.
// MX: NOM-035-STPS-2018 medical exam regimen — drug panel overlaps but is NOT identical.

import type { DrugTestingResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

const TEST_CURRENT_DAYS = 365;       // annual baseline
const TEST_EXPIRING_SOON_DAYS = 335; // within 30 days of annual expiry

function daysBetween(a: string, b: string): number {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.floor(ms / (24 * 3600 * 1000));
}

export function checkDrugTesting(input: DriverComplianceInput): DrugTestingResult {
  const driver = input.driver;

  if (!driver.last_drug_test_iso) {
    return {
      compliant: 'inconclusive',
      reason: 'No drug-test date on file — required for any commercial driver per 49 CFR Part 40',
      days_since_last_test: null,
      test_currency: 'unknown',
      jurisdiction_match: false,
      equivalency_required: false,
      manifest_notes: [
        'Capture last_drug_test_iso + last_drug_test_jurisdiction in driver record',
        DISCLAIMER,
      ],
    };
  }

  const daysSince = daysBetween(new Date().toISOString(), driver.last_drug_test_iso);
  let testCurrency: DrugTestingResult['test_currency'];
  if (daysSince > TEST_CURRENT_DAYS) testCurrency = 'expired';
  else if (daysSince > TEST_EXPIRING_SOON_DAYS) testCurrency = 'expiring_soon';
  else testCurrency = 'current';

  // Jurisdiction match logic
  const tested = driver.last_drug_test_jurisdiction ?? 'US_DOT';
  const route = input.shipment_route;
  let jurisdictionMatch = false;
  let equivalencyRequired = false;

  if (route === 'US_only') {
    jurisdictionMatch = tested === 'US_DOT' || tested === 'BOTH';
    equivalencyRequired = !jurisdictionMatch;
  } else if (route === 'MX_only') {
    jurisdictionMatch = tested === 'MX_SCT' || tested === 'BOTH';
    equivalencyRequired = !jurisdictionMatch;
  } else {
    // cross_border
    jurisdictionMatch = tested === 'BOTH';
    equivalencyRequired = !jurisdictionMatch;
  }

  // Compliance status
  let compliant: DrugTestingResult['compliant'];
  let reason: string;
  const notes: string[] = [];

  if (testCurrency === 'expired') {
    compliant = 'non_compliant';
    reason = `Drug test expired ${daysSince - TEST_CURRENT_DAYS}d ago — annual renewal required before driver re-engages`;
    notes.push('Schedule DOT 5-panel + alcohol screen via SAP-certified collection facility before next shipment');
  } else if (testCurrency === 'expiring_soon') {
    compliant = 'flagged';
    reason = `Drug test current but expires in ${TEST_CURRENT_DAYS - daysSince}d — schedule renewal`;
    notes.push('Schedule annual DOT renewal in next 30 days');
  } else if (equivalencyRequired) {
    compliant = 'flagged';
    reason = route === 'cross_border'
      ? `Test current but jurisdiction is ${tested} only — cross-border shipment requires both US DOT + MX SCT panels`
      : `Test jurisdiction (${tested}) does not match shipment route (${route}) — equivalency mapping required`;
    notes.push('NOM-035-STPS-2018 (MX) and 49 CFR Part 40 (US) overlap on cocaine/opioid/amphetamine panels but differ on cannabis (US Schedule I, MX recently decriminalized) and alcohol thresholds');
    // Structural equivalency table (per-substance mapping) — pattern adopted from Canadian Bill C-46 + provincial frameworks
    notes.push('Equivalency table per substance:');
    notes.push('  cocaine: US-DOT Part 40 ✓ ↔ MX NOM-035-STPS-2018 ✓ (equivalent)');
    notes.push('  opioids: US-DOT Part 40 ✓ ↔ MX NOM-035-STPS-2018 ✓ (equivalent)');
    notes.push('  amphetamine/methamphetamine: US-DOT Part 40 ✓ ↔ MX NOM-035-STPS-2018 ✓ (equivalent)');
    notes.push('  PCP: US-DOT Part 40 ✓ ↔ MX NOM-035-STPS-2018 ✗ (US-only)');
    notes.push('  cannabis (THC): US-DOT Part 40 ✓ ↔ MX NOM-035-STPS-2018 partial (different cutoff post-2021 MX reform)');
    notes.push('  alcohol: US-DOT 0.04% BAC ↔ MX 0.04% BAC commercial (equivalent thresholds)');
    notes.push('Recommend cross-jurisdiction certified collection or supplemental panel before re-engagement');
  } else {
    compliant = 'compliant';
    reason = `Drug test current (${daysSince}d ago, ${tested} jurisdiction matches ${route} route)`;
  }

  notes.push(DISCLAIMER);

  return {
    compliant,
    reason,
    days_since_last_test: daysSince,
    test_currency: testCurrency,
    jurisdiction_match: jurisdictionMatch,
    equivalency_required: equivalencyRequired,
    manifest_notes: notes,
  };
}
```

- [ ] **Step 2:** TS check + commit:

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/drivers/drug-testing.ts && git commit -m "feat(module-5): drug & alcohol testing check (DOT 49 CFR Part 40 + MX equivalency)"
```

---

## Task 8: Borello drayage W-2 vs 1099 classification

**Files:** Create `lib/chassis/drivers/drayage-1099.ts`

Borello test (California Supreme Court, 1989) — 11 factors weighing toward independent contractor status. Misclassification = direct PAGA / Dynamex (extended via AB-5) liability. v1 = deterministic factor-counting + recommendation. **NEVER legal opinion.**

- [ ] **Step 1:** Write the check:

```typescript
// lib/chassis/drivers/drayage-1099.ts
// Borello test (S. G. Borello & Sons v. Department of Industrial Relations, 1989).
// 11 factors weighing toward independent-contractor (1099) status.
// Misclassification → PAGA / Dynamex (AB-5) liability — direct broker exposure.
// v1 = factor-counting heuristic. v2 = jurisdiction-aware (CA AB-5 vs TX vs Federal).

import type { DrayageClassificationResult, DriverComplianceInput } from './types';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination. Borello test outcomes vary by jurisdiction (CA AB-5, TX, Federal) — this score is heuristic.';

const PAGA_RISK_PER_DRIVER_USD = 25_000;       // rough order-of-magnitude per misclassified driver per CA Labor Code §1102.5

export function checkDrayageClassification(input: DriverComplianceInput): DrayageClassificationResult {
  const d = input.driver;
  const declared = d.employment_classification ?? 'unknown';

  // 11 Borello factors — each "yes" weighs toward 1099 (independent contractor)
  // Some factors weigh stronger; v1 uses simple count.
  let borelloScore = 0;
  const factorsHit: string[] = [];

  if (d.uses_own_truck) { borelloScore++; factorsHit.push('owns own truck (capital investment)'); }
  if (d.sets_own_schedule) { borelloScore++; factorsHit.push('sets own schedule'); }
  if (d.works_for_other_carriers) { borelloScore += 2; factorsHit.push('works for multiple carriers (strong 1099 signal)'); }
  if (d.carries_independent_business_expenses) { borelloScore++; factorsHit.push('carries independent business expenses'); }
  if (d.paid_per_mile && !d.paid_hourly) { borelloScore++; factorsHit.push('paid per-mile (not hourly)'); }
  if (d.has_own_dot_authority) { borelloScore += 2; factorsHit.push('has own DOT authority (strong 1099 signal)'); }
  // Implicit factors (weight per Borello 1989 + Dynamex 2018):
  // - Right to discharge at will → counts toward W-2 (not surfaced unless broker captures)
  // - Skill required → counts toward 1099 if specialized
  // - Method of payment (regular wage vs by-job) → already covered by paid_per_mile

  // Recommendation logic
  let rec: 'W2' | '1099' | 'borderline_review';
  if (borelloScore >= 5) rec = '1099';
  else if (borelloScore <= 2) rec = 'W2';
  else rec = 'borderline_review';

  const match = (declared === rec) || (rec === 'borderline_review' && declared !== 'unknown');

  // Compliance status + risk math
  let compliant: DrayageClassificationResult['compliant'];
  let reason: string;
  let pagaRisk = 0;
  const notes: string[] = [];

  if (declared === 'unknown') {
    compliant = 'inconclusive';
    reason = 'No declared classification — broker must record W2 or 1099 before clearance';
    notes.push('Borello score: ' + borelloScore + '/11. Recommend: ' + rec);
  } else if (rec === 'borderline_review') {
    compliant = 'flagged';
    reason = `Borello score ${borelloScore}/11 — borderline classification, broker review recommended`;
    pagaRisk = PAGA_RISK_PER_DRIVER_USD * 0.5;
    notes.push(`Factors weighing toward 1099: ${factorsHit.join(', ') || 'none'}`);
    notes.push('Borderline cases benefit from documented Borello-factor analysis on file (legal counsel review)');
  } else if (match) {
    compliant = 'compliant';
    reason = `Declared classification (${declared}) matches Borello recommendation (${rec}, score ${borelloScore}/11)`;
  } else {
    compliant = 'non_compliant';
    reason = `Declared classification (${declared}) does NOT match Borello recommendation (${rec}, score ${borelloScore}/11) — misclassification risk`;
    pagaRisk = PAGA_RISK_PER_DRIVER_USD;
    notes.push(`Factors weighing toward ${rec}: ${factorsHit.join(', ') || '(low score, weighing toward W2)'}`);
    notes.push(`PAGA / AB-5 misclassification exposure estimate: $${pagaRisk.toLocaleString()} per affected driver`);
    notes.push('Recommend reclassification or documented Borello defense within 90 days');
  }

  notes.push(DISCLAIMER);

  return {
    compliant,
    reason,
    borello_score: borelloScore,
    classification_recommendation: rec,
    declared_classification: declared,
    classification_match: match,
    paga_risk_estimate_usd: pagaRisk,
    manifest_notes: notes,
  };
}
```

- [ ] **Step 2:** TS check + commit:

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/drivers/drayage-1099.ts && git commit -m "feat(module-5): Borello drayage classification (11 factors, PAGA risk estimate)"
```

---

## Task 9: Composer + manifest builder

**Files:** Create `lib/chassis/drivers/composer.ts`

Orchestrates all 5 checks. Produces unified `DriverComplianceManifest` with the worst-status as `overall_status`.

- [ ] **Step 1:** Write the composer:

```typescript
// lib/chassis/drivers/composer.ts
// Orchestrates the 5 driver-side compliance checks + assembles manifest.

import type { DriverComplianceInput, DriverComplianceManifest, ComplianceStatus, CheckType } from './types';
import { checkUsmcaAnnex31A } from './usmca-annex-31a';
import { checkImss } from './imss';
import { checkHos } from './hos-divergence';
import { checkDrugTesting } from './drug-testing';
import { checkDrayageClassification } from './drayage-1099';

const DISCLAIMER = 'Operational classification only; consult labor counsel for binding determination.';

function worstStatus(statuses: ComplianceStatus[]): ComplianceStatus {
  // priority: non_compliant > flagged > inconclusive > compliant
  if (statuses.includes('non_compliant')) return 'non_compliant';
  if (statuses.includes('flagged')) return 'flagged';
  if (statuses.includes('inconclusive')) return 'inconclusive';
  return 'compliant';
}

export function buildDriverComplianceManifest(input: DriverComplianceInput, ticketId: string | null = null): DriverComplianceManifest {
  const usmca = checkUsmcaAnnex31A(input);
  const imss = checkImss(input);
  const hos = checkHos(input);
  const drug = checkDrugTesting(input);
  const drayage = checkDrayageClassification(input);

  const checks: CheckType[] = ['usmca_annex_31a', 'imss', 'hos', 'drug_testing', 'drayage_classification'];
  const overall = worstStatus([usmca.compliant, imss.compliant, hos.compliant, drug.compliant, drayage.compliant]);

  const blocking: string[] = [];
  if (usmca.compliant === 'non_compliant' || usmca.compliant === 'flagged') blocking.push(`USMCA Annex 31-A: ${usmca.reason}`);
  if (imss.compliant === 'non_compliant') blocking.push(`IMSS: ${imss.reason}`);
  if (hos.compliant === 'non_compliant') blocking.push(`HOS: ${hos.reason}`);
  if (drug.compliant === 'non_compliant') blocking.push(`Drug testing: ${drug.reason}`);
  if (drayage.compliant === 'non_compliant') blocking.push(`Drayage classification: ${drayage.reason}`);

  return {
    driver_ref: input.driver.driver_ref,
    shipment_ref: input.shipment_ref,
    checks_run: checks,
    usmca_annex_31a: usmca,
    imss,
    hos,
    drug_testing: drug,
    drayage_classification: drayage,
    overall_status: overall,
    blocking_issues: blocking,
    composed_at_iso: new Date().toISOString(),
    ticket_id: ticketId,
    disclaimer: DISCLAIMER,
  };
}
```

- [ ] **Step 2:** TS check + commit:

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/drivers/composer.ts && git commit -m "feat(module-5): composer + manifest builder (5 checks + overall status)"
```

---

## Task 10: Test cases + 3 verifier scripts

**Files:**
- Create: `data/drivers/test-cases.json` — 25 known-answer cases
- Create: `scripts/verify-hos-divergence.mjs`
- Create: `scripts/verify-drayage-borello.mjs`
- Create: `scripts/verify-drivers-manifest.mjs`

Test set covers each of the 5 checks individually + integrated manifest scenarios. Audit gate: 100% on each per-check verifier (deterministic math) + ≥98% on manifest routing.

- [ ] **Step 1: Create dir + write the test cases.** Use this exact content:

```bash
mkdir -p ~/cruzar/data/drivers
```

`data/drivers/test-cases.json`:

```json
{
  "version": "v1.0",
  "cases": [
    {"id":"drv-001","label":"Clean US-only driver, all checks pass","input":{"driver":{"driver_ref":"D-001","primary_jurisdiction":"US","cdl_class":"A","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","uses_own_truck":false,"sets_own_schedule":false,"works_for_other_carriers":false,"paid_hourly":true},"shipment_ref":"S-001","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"overall_status":"compliant","hos_compliant":"compliant","drayage_compliant":"compliant"}},
    {"id":"drv-002","label":"US-only HOS violation (12h driving > 11h)","input":{"driver":{"driver_ref":"D-002","primary_jurisdiction":"US","employment_classification":"W2","paid_hourly":true},"shipment_ref":"S-002","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":12,"on_duty_hours":13,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":50}},"expected":{"hos_compliant":"non_compliant","overall_status":"non_compliant"}},
    {"id":"drv-003","label":"Cross-border HOS divergence (US-clean 10h, MX-foul 10h>8h)","input":{"driver":{"driver_ref":"D-003","primary_jurisdiction":"BOTH","imss_active":true,"imss_last_payment_iso":"2026-04-15","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"BOTH","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-003","shipment_route":"cross_border","hos_log":{"date_iso":"2026-05-03","driving_hours":10,"on_duty_hours":12,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":50}},"expected":{"hos_compliant":"flagged","hos_divergence_flag":true,"overall_status":"flagged"}},
    {"id":"drv-004","label":"MX-only driver, IMSS lapsed >60d","input":{"driver":{"driver_ref":"D-004","primary_jurisdiction":"MX","imss_active":true,"imss_last_payment_iso":"2026-02-01","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"MX_SCT","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-004","shipment_route":"MX_only","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":15,"cycle_hours_last_7_or_8_days":40}},"expected":{"imss_compliant":"non_compliant","overall_status":"non_compliant"}},
    {"id":"drv-005","label":"Cross-border driver, drug test expired","input":{"driver":{"driver_ref":"D-005","primary_jurisdiction":"BOTH","imss_active":true,"imss_last_payment_iso":"2026-04-15","last_drug_test_iso":"2024-04-15","last_drug_test_jurisdiction":"BOTH","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-005","shipment_route":"cross_border","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"drug_testing_compliant":"non_compliant","overall_status":"non_compliant"}},
    {"id":"drv-006","label":"1099 driver with high Borello score (clean)","input":{"driver":{"driver_ref":"D-006","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"1099","uses_own_truck":true,"sets_own_schedule":true,"works_for_other_carriers":true,"carries_independent_business_expenses":true,"paid_per_mile":true,"has_own_dot_authority":true},"shipment_ref":"S-006","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drayage_compliant":"compliant","drayage_recommendation":"1099","overall_status":"compliant"}},
    {"id":"drv-007","label":"1099 declared but Borello score low (misclassification)","input":{"driver":{"driver_ref":"D-007","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"1099","uses_own_truck":false,"sets_own_schedule":false,"works_for_other_carriers":false,"paid_hourly":true},"shipment_ref":"S-007","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drayage_compliant":"non_compliant","drayage_recommendation":"W2","overall_status":"non_compliant"}},
    {"id":"drv-008","label":"Borderline Borello (3-4 factors)","input":{"driver":{"driver_ref":"D-008","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"1099","uses_own_truck":true,"sets_own_schedule":true,"paid_per_mile":true},"shipment_ref":"S-008","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drayage_compliant":"flagged","drayage_recommendation":"borderline_review"}},
    {"id":"drv-009","label":"Cross-border with no facility attestation","input":{"driver":{"driver_ref":"D-009","primary_jurisdiction":"BOTH","imss_active":true,"imss_last_payment_iso":"2026-04-15","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"BOTH","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":false},"shipment_ref":"S-009","shipment_route":"cross_border","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"usmca_compliant":"flagged","overall_status":"flagged"}},
    {"id":"drv-010","label":"MX-only IMSS lapsed 30-60d (flagged)","input":{"driver":{"driver_ref":"D-010","primary_jurisdiction":"MX","imss_active":true,"imss_last_payment_iso":"2026-03-15","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"MX_SCT","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-010","shipment_route":"MX_only","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"imss_compliant":"flagged","overall_status":"flagged"}},
    {"id":"drv-011","label":"Drug test current but jurisdiction mismatch (US-only test, cross-border)","input":{"driver":{"driver_ref":"D-011","primary_jurisdiction":"BOTH","imss_active":true,"imss_last_payment_iso":"2026-04-15","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-011","shipment_route":"cross_border","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"drug_testing_compliant":"flagged","overall_status":"flagged"}},
    {"id":"drv-012","label":"Drug test expiring soon (< 30d)","input":{"driver":{"driver_ref":"D-012","primary_jurisdiction":"US","last_drug_test_iso":"2025-05-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","paid_hourly":true},"shipment_ref":"S-012","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drug_testing_compliant":"flagged"}},
    {"id":"drv-013","label":"No HOS log → inconclusive","input":{"driver":{"driver_ref":"D-013","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","paid_hourly":true},"shipment_ref":"S-013","shipment_route":"US_only"},"expected":{"hos_compliant":"inconclusive","overall_status":"inconclusive"}},
    {"id":"drv-014","label":"No drug-test date → inconclusive","input":{"driver":{"driver_ref":"D-014","primary_jurisdiction":"US","employment_classification":"W2","paid_hourly":true},"shipment_ref":"S-014","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drug_testing_compliant":"inconclusive","overall_status":"inconclusive"}},
    {"id":"drv-015","label":"Cycle hours over 70 (US 8-day cycle violation)","input":{"driver":{"driver_ref":"D-015","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","paid_hourly":true},"shipment_ref":"S-015","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":75}},"expected":{"hos_compliant":"non_compliant","overall_status":"non_compliant"}},
    {"id":"drv-016","label":"MX driving over 8h (MX-only violation)","input":{"driver":{"driver_ref":"D-016","primary_jurisdiction":"MX","imss_active":true,"imss_last_payment_iso":"2026-04-15","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"MX_SCT","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-016","shipment_route":"MX_only","hos_log":{"date_iso":"2026-05-03","driving_hours":9,"on_duty_hours":10,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"hos_compliant":"non_compliant","overall_status":"non_compliant"}},
    {"id":"drv-017","label":"Cross-border BOTH-clean","input":{"driver":{"driver_ref":"D-017","primary_jurisdiction":"BOTH","imss_active":true,"imss_last_payment_iso":"2026-04-15","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"BOTH","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-017","shipment_route":"cross_border","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"hos_compliant":"compliant","overall_status":"compliant"}},
    {"id":"drv-018","label":"IMSS active but no payment date (flagged)","input":{"driver":{"driver_ref":"D-018","primary_jurisdiction":"MX","imss_active":true,"last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"MX_SCT","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-018","shipment_route":"MX_only","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"imss_compliant":"flagged","overall_status":"flagged"}},
    {"id":"drv-019","label":"IMSS inactive (non_compliant)","input":{"driver":{"driver_ref":"D-019","primary_jurisdiction":"MX","imss_active":false,"last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"MX_SCT","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-019","shipment_route":"MX_only","hos_log":{"date_iso":"2026-05-03","driving_hours":7,"on_duty_hours":8,"rest_hours_prior":14,"cycle_hours_last_7_or_8_days":40}},"expected":{"imss_compliant":"non_compliant","overall_status":"non_compliant"}},
    {"id":"drv-020","label":"Borello score 5 + declared 1099 (clean)","input":{"driver":{"driver_ref":"D-020","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"1099","uses_own_truck":true,"sets_own_schedule":true,"works_for_other_carriers":true,"paid_per_mile":true,"has_own_dot_authority":true},"shipment_ref":"S-020","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drayage_compliant":"compliant","drayage_recommendation":"1099"}},
    {"id":"drv-021","label":"Borello score 1, declared W2 (clean)","input":{"driver":{"driver_ref":"D-021","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","paid_hourly":true,"sets_own_schedule":false,"uses_own_truck":false},"shipment_ref":"S-021","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drayage_compliant":"compliant","drayage_recommendation":"W2"}},
    {"id":"drv-022","label":"Drayage classification unknown → inconclusive","input":{"driver":{"driver_ref":"D-022","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","paid_hourly":true},"shipment_ref":"S-022","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}},"expected":{"drayage_compliant":"inconclusive","overall_status":"inconclusive"}},
    {"id":"drv-023","label":"Multi-fail (HOS + drug + drayage)","input":{"driver":{"driver_ref":"D-023","primary_jurisdiction":"US","last_drug_test_iso":"2024-04-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"1099","paid_hourly":true},"shipment_ref":"S-023","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":13,"on_duty_hours":15,"rest_hours_prior":8,"cycle_hours_last_7_or_8_days":75}},"expected":{"overall_status":"non_compliant"}},
    {"id":"drv-024","label":"Cross-border BOTH-foul (US over 11h, MX over 8h)","input":{"driver":{"driver_ref":"D-024","primary_jurisdiction":"BOTH","imss_active":true,"imss_last_payment_iso":"2026-04-15","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"BOTH","employment_classification":"W2","paid_hourly":true,"facility_attestation_uploaded":true},"shipment_ref":"S-024","shipment_route":"cross_border","hos_log":{"date_iso":"2026-05-03","driving_hours":12,"on_duty_hours":14,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":50}},"expected":{"hos_compliant":"non_compliant","overall_status":"non_compliant"}},
    {"id":"drv-025","label":"30-min break required flag (over 8h driving in US)","input":{"driver":{"driver_ref":"D-025","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","paid_hourly":true},"shipment_ref":"S-025","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":10,"on_duty_hours":13,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":50}},"expected":{"hos_break_required":true,"hos_compliant":"compliant"}}
  ]
}
```

- [ ] **Step 2: Write the manifest verifier** at `~/cruzar/scripts/verify-drivers-manifest.mjs`:

```javascript
// scripts/verify-drivers-manifest.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { buildDriverComplianceManifest } = await import('../lib/chassis/drivers/composer.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/drivers/test-cases.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = buildDriverComplianceManifest(c.input);
  const e = c.expected;
  let ok = true;
  if (e.overall_status !== undefined && got.overall_status !== e.overall_status) ok = false;
  if (e.hos_compliant !== undefined && got.hos?.compliant !== e.hos_compliant) ok = false;
  if (e.imss_compliant !== undefined && got.imss?.compliant !== e.imss_compliant) ok = false;
  if (e.drug_testing_compliant !== undefined && got.drug_testing?.compliant !== e.drug_testing_compliant) ok = false;
  if (e.drayage_compliant !== undefined && got.drayage_classification?.compliant !== e.drayage_compliant) ok = false;
  if (e.usmca_compliant !== undefined && got.usmca_annex_31a?.compliant !== e.usmca_compliant) ok = false;
  if (e.drayage_recommendation !== undefined && got.drayage_classification?.classification_recommendation !== e.drayage_recommendation) ok = false;
  if (e.hos_divergence_flag !== undefined && got.hos?.divergence_flag !== e.hos_divergence_flag) ok = false;
  if (e.hos_break_required !== undefined && got.hos?.us_dot.rest_break_required !== e.hos_break_required) ok = false;
  if (ok) passed++;
  else failures.push({ id: c.id, label: c.label, got: { overall: got.overall_status, hos: got.hos?.compliant, imss: got.imss?.compliant, drug: got.drug_testing?.compliant, drayage: got.drayage_classification?.compliant, usmca: got.usmca_annex_31a?.compliant, drayage_rec: got.drayage_classification?.classification_recommendation, divergence: got.hos?.divergence_flag, break: got.hos?.us_dot.rest_break_required }, expected: e });
}
const pct = (passed / set.cases.length) * 100;
console.log(`Drivers manifest: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} ${f.label}\n    got: ${JSON.stringify(f.got)}\n    expected: ${JSON.stringify(f.expected)}`);
if (pct < 98) { console.error(`FAIL: < 98%`); process.exit(1); }
console.log(`PASS: ≥ 98%`);
```

- [ ] **Step 3: Write HOS-only verifier** at `~/cruzar/scripts/verify-hos-divergence.mjs`:

```javascript
// scripts/verify-hos-divergence.mjs
// Filters test cases to HOS-relevant ones, asserts checkHos output matches expected.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { checkHos } = await import('../lib/chassis/drivers/hos-divergence.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/drivers/test-cases.json'), 'utf-8'));
const filtered = set.cases.filter(c => c.expected.hos_compliant !== undefined || c.expected.hos_divergence_flag !== undefined || c.expected.hos_break_required !== undefined);

let passed = 0;
const failures = [];
for (const c of filtered) {
  const got = checkHos(c.input);
  const e = c.expected;
  let ok = true;
  if (e.hos_compliant !== undefined && got.compliant !== e.hos_compliant) ok = false;
  if (e.hos_divergence_flag !== undefined && got.divergence_flag !== e.hos_divergence_flag) ok = false;
  if (e.hos_break_required !== undefined && got.us_dot.rest_break_required !== e.hos_break_required) ok = false;
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, got: { compliant: got.compliant, divergence: got.divergence_flag, break: got.us_dot.rest_break_required }, expected: e });
}
const pct = filtered.length > 0 ? (passed / filtered.length) * 100 : 100;
console.log(`HOS: ${passed}/${filtered.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} ${f.label}: got ${JSON.stringify(f.got)}; expected ${JSON.stringify(f.expected)}`);
if (pct < 100) { console.error(`FAIL: < 100%`); process.exit(1); }
console.log(`PASS: 100%`);
```

- [ ] **Step 4: Write drayage-only verifier** at `~/cruzar/scripts/verify-drayage-borello.mjs`:

```javascript
// scripts/verify-drayage-borello.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { checkDrayageClassification } = await import('../lib/chassis/drivers/drayage-1099.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/drivers/test-cases.json'), 'utf-8'));
const filtered = set.cases.filter(c => c.expected.drayage_compliant !== undefined || c.expected.drayage_recommendation !== undefined);

let passed = 0;
const failures = [];
for (const c of filtered) {
  const got = checkDrayageClassification(c.input);
  const e = c.expected;
  let ok = true;
  if (e.drayage_compliant !== undefined && got.compliant !== e.drayage_compliant) ok = false;
  if (e.drayage_recommendation !== undefined && got.classification_recommendation !== e.drayage_recommendation) ok = false;
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, got: { compliant: got.compliant, rec: got.classification_recommendation, score: got.borello_score }, expected: e });
}
const pct = filtered.length > 0 ? (passed / filtered.length) * 100 : 100;
console.log(`Drayage Borello: ${passed}/${filtered.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} ${f.label}: got ${JSON.stringify(f.got)}; expected ${JSON.stringify(f.expected)}`);
if (pct < 100) { console.error(`FAIL: < 100%`); process.exit(1); }
console.log(`PASS: 100%`);
```

- [ ] **Step 5: Run all 3:**
```bash
cd ~/cruzar && npm run verify:hos && npm run verify:drayage && npm run verify:drivers
```

Expected: all 3 print `PASS`. If a case fails, **report — do not silently rewrite test data or check logic.**

- [ ] **Step 6: Commit:**
```bash
cd ~/cruzar && git add data/drivers/test-cases.json scripts/verify-hos-divergence.mjs scripts/verify-drayage-borello.mjs scripts/verify-drivers-manifest.mjs && git commit -m "feat(module-5): drivers test cases (25) + HOS + drayage + manifest verifiers"
```

---

## Task 11: Compliance logger + 6 API routes

**Files:**
- Create: `lib/calibration-drivers.ts` — logger
- Create: `app/api/drivers/usmca-annex-31a/route.ts`
- Create: `app/api/drivers/imss/route.ts`
- Create: `app/api/drivers/hos/route.ts`
- Create: `app/api/drivers/drug-testing/route.ts`
- Create: `app/api/drivers/drayage-classification/route.ts`
- Create: `app/api/drivers/manifest/route.ts`

- [ ] **Step 1: Create dirs:**
```bash
mkdir -p ~/cruzar/app/api/drivers/usmca-annex-31a
mkdir -p ~/cruzar/app/api/drivers/imss
mkdir -p ~/cruzar/app/api/drivers/hos
mkdir -p ~/cruzar/app/api/drivers/drug-testing
mkdir -p ~/cruzar/app/api/drivers/drayage-classification
mkdir -p ~/cruzar/app/api/drivers/manifest
```

- [ ] **Step 2: Write logger** at `~/cruzar/lib/calibration-drivers.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { CheckType, ComplianceStatus } from './chassis/drivers/types';

export interface DriverLogEntry {
  ticket_id: string | null;
  shipment_ref: string | null;
  driver_ref: string | null;
  check_type: CheckType | 'manifest';
  input_payload: unknown;
  output_payload: unknown;
  status: ComplianceStatus;
  caller: string;
}

export async function logDriverCompliance(entry: DriverLogEntry): Promise<void> {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supa.from('driver_compliance').insert(entry);
  if (error) console.error('[drivers] logDriverCompliance insert failed:', error.message);
}
```

- [ ] **Step 3: Write 5 per-check routes.** Pattern (adapt per-check function):

`app/api/drivers/manifest/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { buildDriverComplianceManifest } from '@/lib/chassis/drivers/composer';
import { logDriverCompliance } from '@/lib/calibration-drivers';
import type { DriverComplianceInput } from '@/lib/chassis/drivers/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { input?: DriverComplianceInput; ticket_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.input?.driver) return NextResponse.json({ error: 'input.driver required' }, { status: 400 });
  const manifest = buildDriverComplianceManifest(body.input, body.ticket_id ?? null);
  await logDriverCompliance({
    ticket_id: manifest.ticket_id,
    shipment_ref: manifest.shipment_ref,
    driver_ref: manifest.driver_ref,
    check_type: 'manifest',
    input_payload: body.input,
    output_payload: manifest,
    status: manifest.overall_status,
    caller: 'api/drivers/manifest',
  });
  return NextResponse.json(manifest);
}
```

Per-check routes follow the same shape — POST takes `{ input: DriverComplianceInput }`, calls the specific check function, logs, returns. Five files, one per check (`usmca-annex-31a`, `imss`, `hos`, `drug-testing`, `drayage-classification`).

`app/api/drivers/hos/route.ts` example:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkHos } from '@/lib/chassis/drivers/hos-divergence';
import { logDriverCompliance } from '@/lib/calibration-drivers';
import type { DriverComplianceInput } from '@/lib/chassis/drivers/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { input?: DriverComplianceInput };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.input?.driver) return NextResponse.json({ error: 'input.driver required' }, { status: 400 });
  const result = checkHos(body.input);
  await logDriverCompliance({
    ticket_id: null,
    shipment_ref: body.input.shipment_ref ?? null,
    driver_ref: body.input.driver.driver_ref,
    check_type: 'hos',
    input_payload: body.input,
    output_payload: result,
    status: result.compliant,
    caller: 'api/drivers/hos',
  });
  return NextResponse.json(result);
}
```

Replicate for the other 4 check routes — same shape, different `checkXxx` function and `check_type` string.

- [ ] **Step 4: TS check + build:**
```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && npm run build 2>&1 | tail -10
```
Expected: clean. Page count grows by 6 routes.

- [ ] **Step 5: Smoke test the manifest route** (no tesseract → fast):
```bash
curl -fsS -X POST http://localhost:3000/api/drivers/manifest \
  -H 'Content-Type: application/json' \
  -d '{"input":{"driver":{"driver_ref":"smoke-D1","primary_jurisdiction":"US","last_drug_test_iso":"2026-01-15","last_drug_test_jurisdiction":"US_DOT","employment_classification":"W2","paid_hourly":true},"shipment_ref":"smoke-S1","shipment_route":"US_only","hos_log":{"date_iso":"2026-05-03","driving_hours":8,"on_duty_hours":12,"rest_hours_prior":10,"cycle_hours_last_7_or_8_days":40}}}' 2>&1 | head -c 500
```
Expected: JSON with `overall_status: "compliant"`, `checks_run: ["usmca_annex_31a","imss","hos","drug_testing","drayage_classification"]`.

- [ ] **Step 6: Commit:**
```bash
cd ~/cruzar && git add lib/calibration-drivers.ts app/api/drivers && git commit -m "feat(module-5): 6 driver-compliance API routes + compliance logger"
```

---

## Task 12: /insights/drivers UI

**Files:**
- Create: `app/insights/drivers/page.tsx`
- Create: `app/insights/drivers/DriversClient.tsx`

Bilingual EN/ES form: driver record + shipment context inputs → renders 5-check manifest result.

- [ ] **Step 1:** Create dir + write server page (`app/insights/drivers/page.tsx`):

```typescript
import DriversClient from './DriversClient';

export const dynamic = 'force-dynamic';

export default function DriversPage() {
  return (
    <main className="mx-auto max-w-4xl p-6 text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Driver Compliance / Cumplimiento del Operador</h1>
        <p className="mt-1 text-sm text-white/60">
          Run 5 driver-side compliance checks (USMCA Annex 31-A, IMSS, HOS dual-regime, drug testing, Borello drayage classification) before clearance.
        </p>
        <p className="mt-1 text-sm text-white/60">
          Ejecute 5 verificaciones del operador antes del despacho (T-MEC Anexo 31-A, IMSS, HOS doble regimen, prueba antidoping, clasificacion drayage Borello).
        </p>
      </header>
      <DriversClient />
    </main>
  );
}
```

- [ ] **Step 2:** Write client at `app/insights/drivers/DriversClient.tsx` — bilingual form with fields for `driver_ref`, `primary_jurisdiction`, `imss_*`, `last_drug_test_iso`, `last_drug_test_jurisdiction`, `employment_classification`, Borello factors as checkboxes, `shipment_route`, `hos_log` block. Submit POSTs to `/api/drivers/manifest`. Render result with 5 cards (one per check) + overall status badge + blocking_issues red banner + disclaimer footer.

(Component is sizable — pattern lifts from `app/paperwork/PaperworkClient.tsx` but with structured form fields instead of file upload. Compose the form, post JSON to `/api/drivers/manifest`, render the manifest result. Use Tailwind + `useState` for form state.)

- [ ] **Step 3:** Build check:
```bash
cd ~/cruzar && npm run build 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 4:** Commit:
```bash
cd ~/cruzar && git add app/insights/drivers && git commit -m "feat(module-5): /insights/drivers page (broker compliance UI, bilingual EN/ES)"
```

---

## Task 13: Ticket bundle drivers extension

**Files:**
- Modify: `lib/ticket/types.ts` — add `TicketDriversBlock`
- Modify: `lib/ticket/generate.ts` — accept optional `driversInput`
- Modify: `lib/copy/ticket-en.ts` + `ticket-es.ts` — drivers section labels
- Modify: `lib/ticket/pdf.ts` — render drivers section
- Modify: `app/ticket/[id]/page.tsx` — render drivers section

- [ ] **Step 1:** Add to `lib/ticket/types.ts`:

```typescript
import type { DriverComplianceManifest } from '../chassis/drivers/types';

export interface TicketDriversBlock {
  manifest: DriverComplianceManifest;
  overall_status: DriverComplianceManifest['overall_status'];
  blocking_issues: string[];
}
```

Extend `CruzarTicketV1` — add `drivers?: TicketDriversBlock;` after `paperwork?:`. The `modules_present` element type already accepts `'drivers'`.

- [ ] **Step 2:** Extend `lib/ticket/generate.ts` — add `driversInput?: DriverComplianceInput` to `GenerateOptions`. After the paperwork block computation, add:

```typescript
  let driversBlock: TicketDriversBlock | null = null;
  if (opts.driversInput) {
    const manifest = buildDriverComplianceManifest(opts.driversInput, null);
    driversBlock = {
      manifest,
      overall_status: manifest.overall_status,
      blocking_issues: manifest.blocking_issues,
    };
  }
```

Append `'drivers'` to `modules_present` when `driversBlock` exists. Add `drivers: driversBlock ?? undefined,` to payload.

- [ ] **Step 3:** Add bilingual labels to `lib/copy/ticket-en.ts` + `ticket-es.ts`:

```typescript
// en
drivers_section: 'Driver compliance',
overall_status: 'Overall status',
checks_run: 'Checks',
// es (ASCII-only for PDF)
drivers_section: 'Cumplimiento del operador',
overall_status: 'Estado general',
checks_run: 'Verificaciones',
```

- [ ] **Step 4:** Update `lib/ticket/pdf.ts` and `app/ticket/[id]/page.tsx` to render drivers section after paperwork section. Same bilingual side-by-side pattern as Modules 3 + 4. ASCII-only in PDF.

- [ ] **Step 5:** Build check + smoke test the full flow:
```bash
cd ~/cruzar && npm run build 2>&1 | tail -10
cd ~/cruzar && npx tsx -e "
import * as dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { generateTicket } from './lib/ticket/generate';
(async () => {
  const result = await generateTicket({
    shipment: { product_description: 'Demo', origin_country: 'MX', destination_country: 'US', port_of_entry: '230502', bom: [], transaction_value_usd: 1000, importer_name: 'M5T13', shipment_ref: 'smoke-m5t13' },
    caller: 'smoke-m5t13',
    driversInput: { driver: { driver_ref: 'D-smoke', primary_jurisdiction: 'US', last_drug_test_iso: '2026-01-15', last_drug_test_jurisdiction: 'US_DOT', employment_classification: 'W2', paid_hourly: true }, shipment_ref: 'smoke-m5t13', shipment_route: 'US_only', hos_log: { date_iso: '2026-05-03', driving_hours: 8, on_duty_hours: 12, rest_hours_prior: 10, cycle_hours_last_7_or_8_days: 40 } },
  });
  console.log('ticket_id:', result.signed.payload.ticket_id);
  console.log('modules_present:', result.signed.payload.modules_present);
  console.log('drivers.overall_status:', result.signed.payload.drivers?.overall_status);
})();
"
```

Expected: `modules_present: ['customs','drivers']` (or with regulatory/paperwork if also passed), `drivers.overall_status: 'compliant'`.

- [ ] **Step 6:** Commit:
```bash
cd ~/cruzar && git add lib/ticket lib/copy app/ticket/\[id\]/page.tsx && git commit -m "feat(module-5): Ticket bundle drivers block (modules_present + viewer + PDF)"
```

---

## Task 14: Module 5 audit-gate runner

**Files:** Create `scripts/run-module-5-audit.mjs`

Mirrors Module 4's audit pattern. Adds checks:
- M2/M3/M4 re-runs (LIGIE, HS, RVC, origin, FDA, USDA, ISF, CBP7501, manifest, docs, mx-health, paperwork)
- `HOS-1` — `npm run verify:hos` 100%
- `DRAYAGE-1` — `npm run verify:drayage` 100%
- `DRIVERS-MANIFEST-1` — `npm run verify:drivers` ≥ 98%
- `DRIVERS-CHASSIS-1` — all 7 chassis files present (`types.ts`, `usmca-annex-31a.ts`, `imss.ts`, `hos-divergence.ts`, `drug-testing.ts`, `drayage-1099.ts`, `composer.ts`)
- `DRIVERS-API-1` — all 6 API routes + `/insights/drivers` page present
- `MIGRATION-V79-1` — v79 file present
- `TICKET-DRIVERS-1` — `lib/ticket/types.ts` contains `TicketDriversBlock`
- Build clean (opt-in via NEXT_BUILD_AUDIT)

- [ ] **Step 1:** Write the runner (mirror `scripts/run-module-4-audit.mjs` structure verbatim, extend with Module 5 checks).

- [ ] **Step 2:** Run:
```bash
cd ~/cruzar && CRUZAR_AUDIT_HOST=http://localhost:3000 npm run audit:module-5 2>&1 | tail -25
```
Expected: ≥ 28 checks pass. Reconciliation log written.

- [ ] **Step 3:** Commit:
```bash
cd ~/cruzar && git add scripts/run-module-5-audit.mjs && git commit -m "feat(module-5): audit-gate runner (extends M4 + adds 7 drivers checks)"
```

---

## Task 15: MEMORY + vault update + push

- [ ] **Step 1:** Add MEMORY.md "Recent fix logs" entry pointing at the Reconciliation log.

- [ ] **Step 2:** Add to `~/brain/projects/Cruzar.md` Active queue (top entry — Module 5 SHIPPED, with the standard caveat that prod functions may behave differently from dev for any feature).

- [ ] **Step 3:** Push both repos:
```bash
cd ~/cruzar && git push origin main
cd ~/brain && git add projects/Cruzar.md && git commit -m "vault: Module 5 SHIPPED + audit PASSED" && git push
```

---

## Self-review

**Spec coverage** — every Module 5 audit-gate criterion in the spec mapped:
- USMCA Annex 31-A on 20 facility records ≥ 95% → Tasks 4 + 10 (test cases include attestation/no-attestation; per-check correctness via manifest verifier)
- IMSS status check on 20 drivers 100% → Tasks 5 + 10
- HOS dual-regime calculator on 30 known-answer cases 100% → Tasks 6 + 10 + verify:hos
- HOS divergence flag on test cases 100% → Task 10 (cases reg-003 + 017 + 024)
- Drug-testing equivalency mapper on 20 cases ≥ 98% → Tasks 7 + 10
- Borello-test drayage classification on 30 cases ≥ 95% → Tasks 8 + 10 + verify:drayage
- Calibration log per driver compliance call 100% → Task 11 (logger writes to driver_compliance per route)
- `/insights/drivers` page renders bilingual EN/ES → Task 12
- `npm run build` clean → Task 11 + Task 14 audit BUILD-1
- Bilingual coverage of new strings 100% → Task 12 + Task 13

**Placeholder scan** — no "TBD"/"TODO" in step bodies. Every `'TBD'` literal is broker-fills-this-in placeholder text on disclaimer fields, documented inline.

**Type consistency** — `DriverRecord` defined Task 3, used in Tasks 4/5/6/7/8/9/11/12/13. `ComplianceStatus` enum identical across check results, manifest, logger, DB schema (Task 2 CHECK constraint matches type union).

**Bilingual coverage** — every new user-facing string in `lib/copy/ticket-{en,es}.ts` (Task 13) or in `/insights/drivers` page itself (Task 12). API errors are technical only.

**Cruzar guardrails** — no Aguirre, no FB auto-poster, no AI/model/MCP language in customer-facing copy. Migrations via `npm run apply-migration`. Pricing tiers untouched. No legal opinion (every check carries the operational-only disclaimer per spec).

**Liability posture** — Borello drayage check explicitly disclaims legal opinion ("Operational classification only; consult labor counsel for binding determination") on every output. PAGA risk estimate is heuristic order-of-magnitude. No bright-line "this driver IS misclassified" language.

---

## Awaiting

Diego review of this plan. Once approved, invoke `superpowers:subagent-driven-development` to execute (matches Modules 2 + 3 + 4 pattern).
