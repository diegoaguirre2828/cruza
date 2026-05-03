---
title: Cruzar Module 14 — IEEPA Refund Composer + Eligibility Scanner + Protest Helper — design
date: 2026-05-03
project: cruzar
status: design — awaiting Diego review before writing-plans
authors: Diego (product), Claude (drafting)
revision: v1
related:
  - ~/.claude/projects/C--Users-dnawa/memory/project_cruzar_b2b_research_synthesis_20260503.md
  - ~/.claude/projects/C--Users-dnawa/memory/project_cruzar_module_14_scope_lock_20260503.md
  - ~/.claude/projects/C--Users-dnawa/memory/feedback_palantir_mindset_dont_preconcede_to_incumbents_20260503.md
  - ~/.claude/stash/ecc-curated/skills/customs-trade-compliance/SKILL.md
  - ~/.claude/projects/C--Users-dnawa/memory/_clusters/cruzar_GUARDRAILS.md
  - https://www.cbp.gov/trade/programs-administration/trade-remedies/ieepa-duty-refunds
---

# Cruzar Module 14 — IEEPA Refund Composer

## Why this is a design doc (not a strategic call)

Cruzar's TIER-0 guardrail forbids strategic calls during active building. This document is **explicitly invited by Diego on 2026-05-03** — he greenlit Module 14 as priority #1 in the revised roadmap (jumping ahead of /insights UX overhaul + Module 6 driver pay) after research surfaced the $156-166B IEEPA refund opportunity with an April/May 2026 process launch window. Per the cluster guardrails (`build each individually and audit before continuing`), this spec → plan → build → audit gate cycle ships first.

## Purpose

Ship the IEEPA refund composer chassis that:
1. **Identifies refund-eligible entries** from a broker's ACE Entry Summary export
2. **Composes the CBP CAPE Declaration CSV** (matches CBP's `ACEP_CapeEntryNumberUploadTemplate.csv` exactly)
3. **Generates Form 19 protest packets** for past-cliff entries
4. **Helps importers enroll in ACH** (the #1 blocker — 273K of 330K importers have no ACH set up)
5. **Tracks refund delivery** end-to-end with notifications
6. **Charges on success** (5% / 3% / 1.5% sliding + $99 floor + free if no recovery)

This is Cruzar's first **revenue-generating module** — every prior module (M2-M5) was infrastructure that becomes monetizable via the existing Insights subscription. M14 has direct per-transaction revenue with each IEEPA refund delivered.

## Locked positioning (anchors all design choices)

- **Palantir mindset, not incumbent-conceded** (`feedback_palantir_mindset_dont_preconcede_to_incumbents_20260503`). Built for the full TAM of 330K importers. Sales focuses on the underserved 273K first because higher conversion rate; product is enterprise-capable from day one.
- **Stage 1 = software-only** — IOR uploads CAPE Declaration to ACE Portal themselves OR grants Cruzar consultant-access. We don't have ABI filer code in Stage 1.
- **Stage 2 (3mo out) = licensed brokerage partnership** — partner with RGV-based licensed broker, they file via ABI, we share revenue. Sourcing partner via Diego + Raul + friends starts now in parallel.
- **Stage 3 (6-12mo) = Cruzar full brokerage** — own license, ABI access, agentic refund discovery.
- **Bilingual EN/ES is standard** — most RGV brokers operate bilingually. Every screen + every email + every notification ships both languages.
- **Calibration extends here too** — every refund we compose enters the calibration log; success rate (refund delivered ÷ filed) becomes a public-facing trust metric.
- **The wedge is `vs Zollback / CustomsGenius / un-tariff / DutyClaims`**:
  - Bilingual + RGV-native (none of them are)
  - Section 232 stacking awareness (rule I05) baked in (un-tariff has it; we match)
  - Mexican-side context — we know which entries are MX origin and what MX-side regs apply (none of them)
  - Already integrated into the broker's TMS via existing Cruzar Tickets (none of them; this is our retention moat)
  - Free eligibility scanner = viral funnel (most have paywalled calculator)

## Architecture

### Data flow

```
Broker (or IOR directly)
  ↓
[Eligibility Scanner — public, free]
  ↓ uploads ACE Entry Summary CSV
[ACE CSV Parser]
  ↓ normalized entries
[IEEPA Classifier] ← matches against IEEPA Chapter 99 registry (versioned JSON, EOs 14193 / 14194 / 14195 / 14257 with date ranges per country)
  ↓ flagged entries
[Stacking Separator (rule I05)] ← splits IEEPA portion from Section 232 / 301 portion on stacked lines
  ↓ refund-eligible portions
[Interest Calculator] ← CBP quarterly overpayment rate per 19 CFR 24.3a, compounded daily from duty payment date
  ↓ principal + interest per entry
[80-Day Cliff Tracker] ← splits entries into CAPE-eligible (Phase 1) vs Protest-required (past cliff)
  ↓
  ├─→ CAPE-eligible: [CAPE CSV Composer] → [Local VAL-F/E/I Prefligth] → broker downloads CSV → uploads to ACE Portal
  └─→ Past-cliff:    [Form 19 Protest Composer] → broker files at port of entry or via ACE Protest module
  ↓
[Refund Delivery Tracker] ← polls broker's ACH inbox / cross-references ACE liquidation status
  ↓ confirmed refund
[Stripe Billing] ← 5% / 3% / 1.5% on confirmed recovery, $99 floor
  ↓
[Calibration Log] ← success rate enters public trust metric
```

### Chassis pieces (each is its own file under `lib/chassis/refunds/`)

| Piece | File | Input | Output |
|---|---|---|---|
| ACE CSV parser | `ace-parser.ts` | broker's ACE Entry Summary CSV export | `Entry[]` (normalized) |
| IEEPA Chapter 99 registry | `ieepa-chapter-99.json` (data file) + `ieepa-registry.ts` (loader) | EO + date + country | applicable IEEPA HTS Chapter 99 codes + duty rate |
| IEEPA classifier | `ieepa-classifier.ts` | `Entry[]` + registry | `Entry[]` with `is_ieepa_eligible: boolean` + `ieepa_amount: number` |
| Stacking separator | `stacking-separator.ts` (rule I05) | `Entry` with multi-tariff line items | separated `{ ieepa_portion, section_232_portion, section_301_portion }` |
| Interest calculator | `interest-calculator.ts` | `{ principal, paid_at, today }` + CBP quarterly rate table | compound-daily interest amount |
| 80-day cliff tracker | `cliff-tracker.ts` | `Entry[]` + today's date | `{ cape_eligible: Entry[], protest_required: Entry[], past_protest_window: Entry[] }` |
| CAPE CSV composer | `cape-composer.ts` | `Entry[]` (CAPE-eligible) | CSV string matching `ACEP_CapeEntryNumberUploadTemplate.csv` |
| Local VAL-F/E/I prefligth | `cape-validator.ts` | composed CSV | `{ valid: boolean, errors: ValError[], warnings: ValWarning[] }` |
| Form 19 protest composer | `form19-composer.ts` | `Entry[]` (protest-required) | PDF + JSON packet ready for filing |
| Composer orchestrator | `composer.ts` | `Entry[]` + IOR profile + options | full `RefundComposition` result with all sections |

### Versioned IEEPA Chapter 99 registry

Hard-coded versioned data file at `data/refunds/ieepa-chapter-99.json`. Schema:

```json
{
  "version": "v1.0.0-2026-05-03",
  "source": "https://www.cbp.gov/trade/programs-administration/trade-remedies/ieepa-duty-refunds",
  "executive_orders": [
    {
      "eo_number": "14193",
      "title": "Imposing Duties to Address the Flow of Illicit Drugs Across Our Northern Border (Canada fentanyl)",
      "country_codes": ["CA"],
      "effective_from": "2025-03-04",
      "effective_to": "2026-02-24",
      "htsus_chapter_99_codes": ["9903.01.10", "9903.01.11"],
      "duty_rate_pct": 25
    },
    {
      "eo_number": "14194",
      "title": "Imposing Duties to Address the Situation at Our Southern Border (Mexico fentanyl)",
      "country_codes": ["MX"],
      "effective_from": "2025-03-04",
      "effective_to": "2026-02-24",
      "htsus_chapter_99_codes": ["9903.01.20", "9903.01.21"],
      "duty_rate_pct": 25
    },
    {
      "eo_number": "14195",
      "title": "Imposing Duties to Address the Synthetic Opioid Supply Chain in PRC (China fentanyl)",
      "country_codes": ["CN"],
      "effective_from": "2025-02-04",
      "effective_to": "2026-02-24",
      "htsus_chapter_99_codes": ["9903.01.30"],
      "duty_rate_pct": 20
    },
    {
      "eo_number": "14257",
      "title": "Regulating Imports With a Reciprocal Tariff to Rectify Trade Practices",
      "country_codes": ["*"],
      "effective_from": "2025-04-05",
      "effective_to": "2026-02-24",
      "htsus_chapter_99_codes": ["9903.02.01", "..."],
      "duty_rate_pct_by_country": {
        "ALL_DEFAULT": 10,
        "CN": 34,
        "VN": 46,
        "..."
      }
    }
  ],
  "interest_rate_table": {
    "2025-Q1": 8.0,
    "2025-Q2": 7.5,
    "2025-Q3": 7.0,
    "2025-Q4": 7.0,
    "2026-Q1": 7.5,
    "2026-Q2": 8.0
  }
}
```

Versioned + diff-able + auditable. Diego (or anyone) can review which IEEPA codes we're claiming and contest.

### Data model (migration v80)

Two new tables:

```sql
-- v80-refund-claims.sql

CREATE TABLE IF NOT EXISTS refund_claims (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  ior_name TEXT NOT NULL,           -- importer of record (legal name)
  ior_id_number TEXT NOT NULL,      -- TIN / Customs-assigned ID
  filer_code TEXT,                  -- broker filer code if filed via broker
  total_entries INT NOT NULL DEFAULT 0,
  total_principal_owed_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_interest_owed_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  cape_eligible_count INT NOT NULL DEFAULT 0,
  protest_required_count INT NOT NULL DEFAULT 0,
  past_protest_window_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, validated, submitted_to_ace, accepted_by_cbp, refund_in_transit, refund_received, rejected
  cape_csv_url TEXT,                -- Vercel Blob URL of composed CSV
  form19_packet_url TEXT,           -- Vercel Blob URL of protest PDF packet
  cape_claim_number TEXT,           -- assigned by CBP after acceptance
  refund_received_at TIMESTAMPTZ,
  refund_received_amount_usd NUMERIC(14,2),
  stripe_charge_id TEXT,
  cruzar_fee_usd NUMERIC(14,2),     -- the % we capture
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_claim_entries (
  id BIGSERIAL PRIMARY KEY,
  claim_id BIGINT NOT NULL REFERENCES refund_claims(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,        -- 14-digit ACE entry number
  entry_date DATE NOT NULL,
  liquidation_date DATE,             -- NULL if unliquidated
  liquidation_status TEXT,           -- 'unliquidated', 'liquidated', 'extended', 'suspended', 'final'
  country_of_origin TEXT,
  htsus_chapter_99_code TEXT,        -- the IEEPA code triggered
  applicable_eo TEXT,                -- 14193, 14194, 14195, 14257
  ieepa_principal_paid_usd NUMERIC(12,2) NOT NULL,
  section_232_paid_usd NUMERIC(12,2) DEFAULT 0,    -- separated via rule I05
  section_301_paid_usd NUMERIC(12,2) DEFAULT 0,
  refund_amount_usd NUMERIC(12,2) NOT NULL,
  interest_accrued_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  cliff_status TEXT NOT NULL,        -- 'cape_eligible', 'protest_required', 'past_protest_window'
  validation_errors JSONB,           -- VAL-F/E/I rule failures from local prefligth
  cbp_response JSONB,                -- when CBP responds via ACE
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACH onboarding tracking — separate table because not every user has a claim yet
CREATE TABLE IF NOT EXISTS ach_onboarding_status (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  ace_portal_account_status TEXT NOT NULL DEFAULT 'not_started',  -- not_started, applied, active
  ace_portal_account_started_at TIMESTAMPTZ,
  ace_portal_account_active_at TIMESTAMPTZ,
  ach_enrollment_status TEXT NOT NULL DEFAULT 'not_started',      -- not_started, in_progress, complete
  ach_enrollment_complete_at TIMESTAMPTZ,
  bank_routing_last4 TEXT,           -- store only last 4 for verification, never full account
  bank_account_last4 TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users see own claims/onboarding; service role has full access
ALTER TABLE refund_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_claim_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ach_onboarding_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY refund_claims_own_select ON refund_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY refund_claims_own_insert ON refund_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY refund_claims_own_update ON refund_claims FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY refund_claim_entries_own_select ON refund_claim_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM refund_claims WHERE id = refund_claim_entries.claim_id AND user_id = auth.uid())
);

CREATE POLICY ach_onboarding_own_all ON ach_onboarding_status FOR ALL USING (auth.uid() = user_id);
```

### API surface (8 routes under `/api/refunds/`)

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/refunds/scan` | POST | Free eligibility scanner — accept ACE CSV, return refund estimate, no auth required | none (rate-limited by IP) |
| `/api/refunds/claims` | GET / POST | List user's claims / create new claim | user |
| `/api/refunds/claims/[id]` | GET / PATCH | Get / update claim | user (own) |
| `/api/refunds/claims/[id]/upload-ace-csv` | POST | Upload ACE Entry Summary CSV → parse + classify + compose | user (own) |
| `/api/refunds/claims/[id]/cape-csv` | GET | Download composed CAPE CSV | user (own) |
| `/api/refunds/claims/[id]/form19-packet` | GET | Download protest PDF packet | user (own) |
| `/api/refunds/claims/[id]/mark-submitted` | POST | User reports CAPE Declaration submitted to ACE — we start delivery polling | user (own) |
| `/api/refunds/claims/[id]/mark-received` | POST | User reports refund received → triggers Stripe billing | user (own) |
| `/api/refunds/ach-onboarding` | GET / POST / PATCH | ACH onboarding status + guided flow | user |
| `/api/cron/refund-tracker` | GET | Cron — for claims in `submitted_to_ace`, check if user has marked received; nudge if 60+ days overdue | cron |

### UI surface (4 pages, bilingual EN/ES)

| Route | Purpose | Auth |
|---|---|---|
| `/refunds` | Landing — explain IEEPA refund opportunity, free eligibility scanner CTA, social proof | none |
| `/refunds/scan` | Free public eligibility scanner — drag-drop ACE CSV → estimate + signup CTA | none |
| `/refunds/setup` | ACE Portal + ACH onboarding helper (guided flow, 4 steps with status tracking) | user |
| `/refunds/claims` | Claims dashboard — list, status badges, action items per claim | user |
| `/refunds/claims/[id]` | Single claim — preview entries, download CAPE CSV / Form 19 packet, mark submitted, mark received | user |

### Stripe billing

- Use Stripe **dynamic pricing** (Stripe Charges API with on-the-fly amount, not pre-created prices) since the fee is a % of recovery that varies per claim.
- Charge created on `mark-received` POST: amount = `min(99, max(99, recovery * sliding_pct(recovery)))` USD.
- Stripe customer ID stored on `profiles` row (existing pattern from B2B subscriptions).
- Refund mechanism: if CBP later claws back, we refund the broker's fee proportionally (Stripe Refunds API).

```typescript
// Sliding scale logic
function calculateCruzarFee(recoveryUsd: number): number {
  if (recoveryUsd <= 0) return 0;  // free if no recovery
  let fee = 0;
  const tier1 = Math.min(recoveryUsd, 50_000);
  fee += tier1 * 0.05;
  const tier2 = Math.min(Math.max(recoveryUsd - 50_000, 0), 450_000);  // $50K-$500K
  fee += tier2 * 0.03;
  const tier3 = Math.max(recoveryUsd - 500_000, 0);
  fee += tier3 * 0.015;
  return Math.max(fee, 99);  // $99 floor
}
```

### Ticket bundle extension

Per Cruzar's chassis pattern, every module extends `CruzarTicketV1`. M14 adds an optional `refunds_composed` block:

```typescript
// lib/ticket/types.ts (modify)
export interface TicketRefundsBlock {
  composer_version: string;
  ior_name: string;
  ior_id_number: string;
  total_entries: number;
  cape_eligible_count: number;
  protest_required_count: number;
  total_principal_recoverable_usd: number;
  total_interest_recoverable_usd: number;
  cape_csv_signature: string;       // SHA-256 of composed CSV (audit shield)
  form19_packet_signature: string;
  composed_at: string;              // ISO 8601
}

export interface CruzarTicketV1 {
  // ...existing fields...
  refunds?: TicketRefundsBlock;
}
```

When a broker composes a refund claim, the ticket bundle records a signed audit trail. If CBP later questions the filing, the broker can prove the composition was deterministic + based on the registry version at composition time. **This is the prior-disclosure substrate** (per customs-trade-compliance skill: "the most powerful tool in penalty mitigation").

`modules_present` becomes `['customs','regulatory','paperwork','drivers','refunds']` when refunds are part of the ticket.

## Stage 1 vs Stage 2 vs Stage 3 boundaries

### Stage 1 (this spec — ships in 1-2 weeks)
- Software-only — no ABI filer code, no broker license
- IOR uploads CAPE Declaration to ACE Portal themselves (or grants Cruzar consultant access on their ACE account, which doesn't require broker license)
- Free eligibility scanner — public funnel
- Composer + validator + cliff tracker + interest calculator + Form 19 packet
- ACH onboarding helper
- Refund delivery tracker (polled, not auto-detected since we don't have ACE API access)
- Stripe billing on `mark-received`
- Bilingual EN/ES
- White-label hooks (theme_token JSONB on refund_claims table for Stage 2 partner branding)
- API hooks (REST endpoints documented for TMS integration)

### Stage 2 (3 months out — partner-dependent)
- Partner with licensed RGV customs broker (Diego + Raul + friends sourcing)
- Partner files via ABI on broker's behalf — no ACE upload needed from importer
- Partner-branded ticket viewer + refund composer
- Revenue split: Cruzar 65-70%, partner 30-35%
- Unlocks enterprise-tier importers who won't touch ACE Portal

### Stage 3 (6-12 months out — post-revenue)
- Cruzar hires/licenses own broker
- ABI filer code for Cruzar entity
- Agentic refund discovery — auto-scan IOR's full ACE Entry Summary history (3+ years), find IEEPA-paid entries the broker didn't even flag
- White-label tier — license M14 tooling to law firms + Big-4 to capture top of market without rebrand

## Audit-gate criteria

Module 14 audit gate runs after build. Extends M5 audit. New checks:

- **ACE-PARSER-1**: Parser correctly extracts entry number / date / origin / HTS / duty paid from sample ACE Entry Summary CSV (10 known fixtures, 100% accuracy)
- **IEEPA-CLASSIFIER-1**: Classifier correctly flags IEEPA entries vs non-IEEPA (40 known fixtures, ≥98% accuracy)
- **STACKING-SEPARATOR-1**: Rule I05 separator correctly splits IEEPA from Section 232/301 on stacked lines (15 known fixtures, 100% accuracy)
- **INTEREST-CALCULATOR-1**: Compound-daily interest matches CBP's published methodology to ±$0.01 on 25 test cases
- **CLIFF-TRACKER-1**: Routes 30 test entries to correct bucket (CAPE / protest / past-window) — 100% accuracy
- **CAPE-COMPOSER-1**: Composed CSV byte-matches CBP's `ACEP_CapeEntryNumberUploadTemplate.csv` schema (column count, header, comma-delimited, no extra fields) on 10 fixtures
- **CAPE-VALIDATOR-1**: Local VAL-F/E/I prefligth catches 25 known invalid entries before CSV download
- **FORM19-COMPOSER-1**: Generated PDF contains all required CBP Form 19 fields (entry number, decision challenged, legal basis citing Learning Resources v. Trump, signature line)
- **COMPOSER-ORCHESTRATOR-1**: End-to-end round-trip: ACE CSV → composed CAPE CSV + Form 19 packet → re-parse + verify integrity (5 fixtures)
- **STRIPE-FEE-CALC-1**: Sliding-scale fee calculation matches expected on 8 test recovery amounts (including $0, $1K, $50K, $51K, $499K, $501K, $5M)
- **MIGRATION-V80-1**: refund_claims + refund_claim_entries + ach_onboarding_status tables created with RLS policies
- **TICKET-REFUNDS-1**: TicketRefundsBlock + refunds? field on CruzarTicketV1
- **REFUNDS-API-1**: All 9 API routes + 4 UI pages present
- **REFUNDS-UI-BILINGUAL-1**: Every customer-facing string on /refunds + /refunds/scan + /refunds/setup + /refunds/claims routes through LangContext
- **REGRESS-1**: Existing M2-M5 audit gates still pass

## Test-case strategy

### ACE Entry Summary fixtures (`data/refunds/test-fixtures/`)
- 10 sample ACE CSV exports (anonymized real-world structure)
- Cover: single-line entries, multi-line entries, stacked tariff (IEEPA + 232 + 301 on same line), unliquidated, liquidated <80d, liquidated >80d, liquidated >180d, AD/CVD entries, drawback-flagged entries, reconciliation-flagged entries

### IEEPA classifier known-answer set
- 40 entries with hand-labeled `is_ieepa_eligible: boolean` — covers all 4 EOs, all date ranges, edge cases at effective_from/to boundaries

### Stacking separator known-answer set
- 15 stacked-tariff lines with hand-computed IEEPA / 232 / 301 splits

### Interest calculator known-answer set
- 25 test cases with hand-computed compound-daily interest using actual CBP quarterly rates

### Cliff tracker known-answer set
- 30 entries with mixed liquidation dates around the 80d/180d cliffs

### CAPE CSV schema fixtures
- 10 composed CSVs that should byte-match CBP's template (header, columns, format, no extras)

### CAPE validator known-bad set
- 25 invalid entries covering each VAL-F/E/I rule we know

## Open questions for Diego review

1. **ACE consultant access flow** — does Cruzar want to facilitate this (Diego asks importer to add Cruzar as consultant on their ACE account, we then upload directly), or strictly leave the upload to the IOR? Consultant flow = lower friction but we need a TOS update for the access.
2. **Stripe charge timing** — charge on `mark-received` (user-confirmed refund delivery) is conservative. Alternative: charge on `cape_claim_number` issued (CBP accepted the declaration, refund nominally in flight). Conservative is safer for trust; aggressive accelerates cash flow. Recommend conservative for v0.
3. **Form 19 protest packet** — we COMPOSE the packet but don't FILE it (no ABI in Stage 1). Is the user expected to file it themselves at the port of entry / via ACE Protest module? OR do we want a "we'll handle filing" tier that requires the licensed broker partner (deferred to Stage 2)?
4. **ACE Entry Summary CSV format** — there are multiple ACE export formats (Entry Summary by Filer, ACE Reports, etc). Which does the v0 parser support? Recommend supporting both common variants.
5. **IEEPA Chapter 99 registry currency** — registry needs a process to update when CBP publishes new IEEPA HTS codes. Recommend: monthly manual review + version bump initially; Stage 3 = automated CBP CSMS scraper.
6. **Multi-IOR brokers** — a broker can file CAPE for multiple IORs they've represented. v0 should handle multi-IOR claims (one user can have many IOR claims). Recommend supporting from day one.
7. **PII / secrets handling** — bank account info on ach_onboarding_status: store only last 4 digits, never full numbers. CBP's actual ACH enrollment happens in the ACE Portal, not on our servers. Confirm acceptable.
8. **Partner-branded ticket viewer (Stage 2 hook)** — should we ship the `theme_token` JSONB column on `refund_claims` in v0 (cheap to add later if we don't), or defer until Stage 2? Recommend: ship the column now, populate later.

## Distribution / Diego-side action items (parallel to build)

1. **Source first 5-10 RGV importer / broker conversations** — Raul + Diego own outreach. Software is useless without first wave to test on.
2. **Source licensed customs broker partner candidate** — RGV preferred. Need Stage 2 partner pipeline; Raul alone unlikely to have one personally — bring on more friends + RGV freight network. Target intro within 30 days.
3. **Confirm Stripe sliding-scale dynamic pricing approach** — alternative is pre-create 3 Stripe products + composite invoice. Recommend dynamic.
4. **Decide TOS update for ACE consultant access** — if we offer this, the user grants Cruzar limited POA over their ACE account. Diego signs off legal language.

---

This spec is awaiting Diego review before transitioning to `superpowers:writing-plans`. Open questions above are real — please answer or push back before plan-writing begins.
