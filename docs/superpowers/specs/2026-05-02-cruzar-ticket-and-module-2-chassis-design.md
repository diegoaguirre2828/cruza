---
title: Cruzar Ticket + 5-module customs-validation chassis — design
date: 2026-05-02
project: cruzar
status: design — awaiting Diego review before writing-plans
authors: Diego (product), Claude (drafting)
revision: v2 (2026-05-02 — Modules 3, 4, 5 pulled in per Diego direction)
related:
  - ~/brain/raw/cruzar-2026-verticals-research-20260502.md
  - ~/.claude/projects/C--Users-dnawa/memory/project_cruzar_ligie_decree_anchor_finding_20260502.md
  - ~/.claude/projects/C--Users-dnawa/memory/project_cruzar_bottom_up_coalition_thesis_20260502.md
  - ~/.claude/skills/customs-trade-compliance/SKILL.md
  - ~/.claude/projects/C--Users-dnawa/memory/_clusters/cruzar_GUARDRAILS.md
---

# Cruzar Ticket + 5-module customs-validation chassis — design

## Why this is a design doc (not a strategic call)

Cruzar's TIER-0 guardrail forbids strategic calls during active building (`feedback_cruzar_no_strategic_calls`). This document is **explicitly invited by Diego on 2026-05-02** — he asked for re-framing, brand thesis, and a written spec before code lands. The brainstorming skill flow (brainstorm → spec → plan → build) is the path Diego greenlit. Once approved, this transitions to `superpowers:writing-plans`, then implementation **with audit gates between each module**.

## Purpose

Ship the full customs-validation chassis that turns Cruzar/insights from "wait-time intelligence" into the **trust layer for cross-border SMB**. The chassis pre-validates every dimension of a cross-border shipment — HS classification, origin, duty math, regulatory notifications, paperwork integrity, and driver compliance — and emits a signed **Cruzar Ticket** (PDF + QR + JSON) that travels with the load.

The Ticket is operational record, audit shield, and prior-disclosure substrate.

This v2 spec covers **all five modules** with explicit audit gates between each. Per Diego 2026-05-02: *"build each individually and audit before continuing with the next ones."*

---

## Locked positioning (anchors all design choices)

- **Bottom-up SMB coalition, inverse of Palantir** (memory `project_cruzar_bottom_up_coalition_thesis_20260502`). Customer copy never references "AI," "model," "MCP," "big logistics," or Palantir-style top-down framing. Density of trust across SMB brokers/shippers is the moat.
- **Camp B alignment.** Cruzar = the people-side / coalition-side instantiation of Symbolic Systems for Camp B (locked 2026-05-01). Stack/Aviso/Fletcher are sibling surfaces.
- **The wedge: LIGIE-decree compliance** (DOF 5777376, eff. 1 Jan 2026, 1,463 tariff lines, 5–50% rate hikes on non-FTA origin). Module 2 IS the LIGIE-compliance layer.
- **Calibration is the public trust artifact.** Per-port, per-validation accuracy published. Palantir/CHR/Project44 don't publish accuracy. We do.
- **The Ticket is the deliverable.** Not a dashboard, not a forecast — a signed bundle the broker hands to the officer / files in their archive / uses as prior-disclosure substrate.
- **Bilingual EN/ES is standard, not a feature** (per guardrails). Every Ticket renders both.
- **Build each module + audit before continuing** (Diego 2026-05-02). No skipping audit gates.

---

## Architecture

### Layered model

```
Consumer surfaces:    /insights (hero)  /dispatch  /ticket/[id]  /insights/accuracy
                      /paperwork (Module 4)  /insights/drivers (Module 5)
                                  ↓
Cruzar Ticket layer:  PDF generator · QR encoder · JSON signer · supersede chain · Module-aware bundle
                                  ↓
   Module 1            Module 2          Module 3            Module 4            Module 5
   ─────────           ─────────         ─────────           ─────────           ─────────
   Wait-time +         Customs           Regulatory          Paperwork           Driver-side
   calibration         validation        notification        scanner             compliance
   (existing)          (chassis)         (outbound)          (intake)            (HR/comp)

   Sources:            Sources:          Sources:            Sources:            Sources:
   CBP BWT             DOF/SAT           CBP ACE/CATAIR      Claude Vision /     STPS / IMSS
   TTI BCIS            CBP CROSS         FDA Prior Notice    Tesseract OCR       FMCSA / DOT
   bridge cams         USMCA Annex 4-B   USDA APHIS          layout detection    USMCA Annex 31-A
                                  ↓
Calibration layer (per-module):  prediction · outcome · timestamp · delta · public scoreboard
```

Every consumer surface reads from the chassis. The chassis modules each own their own validation/data domain. The Ticket layer composes their outputs into one signed bundle. Calibration logs sit alongside every module.

### Source-of-truth file map

```
~/cruzar/
├── lib/
│   ├── chassis/
│   │   ├── customs/                 # Module 2
│   │   │   ├── hs-classifier.ts
│   │   │   ├── origin-validator.ts
│   │   │   ├── rvc-calculator.ts
│   │   │   ├── usmca-preference.ts
│   │   │   ├── ligie-flag.ts        # 1,463 tariff lines lookup
│   │   │   └── types.ts
│   │   ├── regulatory/              # Module 3
│   │   │   ├── fda-prior-notice.ts
│   │   │   ├── usda-aphis.ts
│   │   │   ├── isf-10-2.ts
│   │   │   ├── cbp-7501.ts
│   │   │   └── submitter.ts         # routes outbound to right agency
│   │   ├── docs/                    # Module 4
│   │   │   ├── extractor.ts         # Claude Vision orchestration
│   │   │   ├── classifier.ts        # invoice / packing / BOL / certificate
│   │   │   ├── mx-health-cert.ts    # single-sided + no-handwriting check
│   │   │   ├── multi-page.ts
│   │   │   └── confidence.ts
│   │   └── drivers/                 # Module 5
│   │       ├── usmca-annex-31a.ts   # labor obligations
│   │       ├── imss.ts              # Mexican social-security math
│   │       ├── hos-divergence.ts    # US 11/14/60-70 vs MX 8/9/14
│   │       ├── drug-testing.ts      # 49 CFR Part 40 + MX equivalency
│   │       └── drayage-1099.ts      # Borello test
│   ├── ticket/                      # Module 0 cross-cutting
│   │   ├── generate.ts              # composes outputs from all modules
│   │   ├── pdf.ts                   # bilingual EN/ES rendering
│   │   ├── qr.ts
│   │   ├── json-signer.ts           # Ed25519
│   │   └── verifier.ts
│   └── calibration/
│       └── log.ts                   # extends existing calibration_log
├── app/
│   ├── insights/
│   │   ├── page.tsx                 # rewritten hero
│   │   ├── accuracy/page.tsx        # per-module scoreboard
│   │   └── drivers/page.tsx         # Module 5 surface
│   ├── paperwork/                   # Module 4 surface
│   │   └── page.tsx
│   ├── ticket/[id]/
│   │   └── page.tsx
│   └── api/
│       ├── ticket/
│       │   ├── generate/route.ts
│       │   └── verify/route.ts
│       ├── customs/                 # Module 2
│       │   ├── classify/route.ts
│       │   ├── validate-origin/route.ts
│       │   └── calculate-rvc/route.ts
│       ├── regulatory/              # Module 3
│       │   ├── fda-prior-notice/route.ts
│       │   ├── usda-aphis/route.ts
│       │   ├── isf-10-2/route.ts
│       │   └── cbp-7501/route.ts
│       ├── paperwork/               # Module 4
│       │   ├── extract/route.ts
│       │   └── classify/route.ts
│       └── drivers/                 # Module 5
│           ├── compliance-check/route.ts
│           └── hos-status/route.ts
└── supabase/migrations/
    ├── vXX_customs_validations.sql      # Module 2 log
    ├── vXX_tickets.sql                  # Ticket store
    ├── vXX_regulatory_submissions.sql   # Module 3 log
    ├── vXX_doc_extractions.sql          # Module 4 log
    └── vXX_driver_compliance.sql        # Module 5 log
```

**Migrations apply via `npm run apply-migration -- <path>`** (per guardrails — never paste SQL).

---

## Cruzar Ticket layer (Module 0 — cross-cutting)

The Ticket is the signed bundle. It spans all modules — every module that ran for a given shipment contributes data into the Ticket.

### Built incrementally

- After Module 2 ships: Ticket contains customs validation only
- After Module 3 ships: Ticket adds regulatory submission references
- After Module 4 ships: Ticket adds paperwork-extraction confidence + scan hashes
- After Module 5 ships: Ticket adds driver-compliance status

This is intentional — the Ticket grows in value as modules ship, and brokers see the chassis maturing.

### Bundle contents (full version after all 5 modules)

```
Cruzar Ticket vX
─────────────────
ticket_id:          cr_2026_05_02_abc123
issued_at:          2026-05-02T20:30:00Z
issuer:             Cruzar Insights, Inc. (Ed25519 signature below)
modules_present:    [customs, regulatory, paperwork, drivers]   # which modules fed this Ticket
shipment:
  origin:           MX, Reynosa
  destination:      US, Pharr (port code 2304)
  consignee:        <broker>
  carrier:          <DOT/SCAC>
  bol_ref:          <commercial>
hs_classification:  (Module 2)
  hts_10:           9018.39.0080
  description:      "Catheter, intravascular, sterile"
  gri_path:         "GRI 1 → Heading 9018; subheading per GRI 6 + Note 2"
  cbp_cross_ref:    "HQ H298456 (analogous)"
origin:             (Module 2)
  usmca_originating: true
  rvc_method:       net_cost
  rvc_value:        72.4
  usmca_threshold:  60
  ligie_affected:   false
  preferential_rate: 0
regulatory:         (Module 3)
  fda_prior_notice: { confirmation: "FDA-PN-2026-...", submitted_at: "T-3h" }
  usda_aphis:       { ref: "PPQ-587-...", status: "approved" }
  isf_10_2:         { ref: "ISF-...", elements_count: 12, status: "accepted" }
  cbp_7501:         { ref: "ENT-...", filed_within: "10d" }
paperwork:          (Module 4)
  commercial_invoice: { extracted: true, confidence: 0.97, fields_validated: 14 }
  packing_list:     { extracted: true, confidence: 0.99 }
  certificate_origin: { generated: true, source: "USMCA Article 5.2" }
  bol:              { extracted: true, confidence: 0.96 }
  mx_health_cert:   { single_sided: true, handwriting_detected: false }
drivers:            (Module 5)
  usmca_annex_31a:  compliant
  imss_status:      current
  hos_status:       within limits (US: 8h/11h, MX: 6h/9h)
  drug_testing:     last test 14d ago (DOT-MX equivalency confirmed)
  drayage_class:    W-2 (passes Borello test)
audit_shield:
  prior_disclosure_eligible: true
  19_USC_1592_basis: "Negligence threshold met if violation surfaces"
calibration:
  classifier_accuracy_30d: 98.4%
  origin_accuracy_30d:     99.1%
  regulatory_acceptance_30d: 99.8%
  doc_extraction_accuracy_30d: 96.2%
  driver_compliance_accuracy_30d: 98.7%
signature:           <base64 Ed25519 over canonical JSON>
verify_url:          https://cruzar.app/ticket/cr_2026_05_02_abc123
```

### Three deliverables per Ticket

1. **Signed JSON** (canonical, machine-readable) — Ed25519, public verification key at `https://cruzar.app/.well-known/cruzar-ticket-key.json`
2. **Printable PDF** — bilingual EN/ES side-by-side, broker-friendly, QR + verify URL at bottom
3. **QR code** — encodes ticket_id + 64-char content hash → officer scans → 3-second yes/no on public verifier

### Why "Ticket"

Locked 2026-05-02. Active connotation, broker-friendly, network-effect-friendly. We don't claim regulatory issuance authority ("Passport"). The brand earns into "Passport" only if/when density makes it a de facto industry standard.

---

## Module 1 — Wait-time + calibration (existing, brief)

Already shipped. Calibration log + `/admin/calibration` exist. Active queue includes customer-facing scoreboard at `/insights/accuracy` (~2 hrs work, 80% there).

**Build action in this spec:** finish customer-facing `/insights/accuracy` scoreboard with split per-module accuracy + 30-day rolling chart. This becomes the trust artifact for the new positioning.

**Module 1 audit (already implicitly running):** rolling per-port accuracy ≥ goal, calibration_log writing on every prediction.

---

## Module 2 — Customs validation chassis

The load-bearing build. Lifts directly from `customs-trade-compliance` skill (now installed at `~/.claude/skills/customs-trade-compliance/`) — GRI 1-6 logic, valuation method hierarchy, FTA qualification analysis, penalty framework. We don't rebuild the customs ontology; we lift it.

### 2.1 HS classifier

**Input:** product description, optional binding-ruling reference, optional manufacturer-provided HS code.
**Output:** 6-digit HS + 10-digit HTS recommendation, GRI rationale, confidence score, alternative classifications considered + rejected, supporting CBP CROSS ruling references.
**Logic (lifted from skill §HS Tariff Classification):** GRI 1 (90% of cases) → GRI 2 → GRI 3(a)/(b)/(c) → GRI 6 → CBP CROSS lookup → record rationale.
**Calibration:** every classification logged with broker-confirmed outcome (post-clearance) → public scoreboard.

### 2.2 Origin validator + LIGIE flag

**Input:** product HS, BOM (sub-component HS + country of origin), declared country of origin.
**Output:** USMCA-originating yes/no, LIGIE-affected yes/no with rate, preferential vs MFN vs LIGIE rate comparison, USMCA Article 5.2 9-element certification draft.
**Logic:**
1. USMCA Annex 4-B product-specific rule lookup
2. Trace non-originating BOM inputs through tariff-shift test
3. If tariff-shift fails, fall through to RVC (§2.3)
4. LIGIE 1,463-line lookup per BOM input → flag rate if matches
5. Net result: USMCA preferential OR LIGIE rate (X%) OR MFN rate (Y%)

The LIGIE lookup table is THE 2026 wedge data. Loaded from DOF 5777376 (Russell Bedford México has the consolidated table). Update cadence: manual at first; eventually `brain-weekly` cron pulls.

### 2.3 RVC calculator

**Formulas (per skill §Duty Optimization):**
- TV method: `RVC = ((TV − VNM) / TV) × 100`
- NC method: `RVC = ((NC − VNM) / NC) × 100`

Net Cost excludes sales promotion, royalties, shipping → often higher RVC when margins are thin. Forward-protection against USMCA review (1 July 2026) auto-RoO 75% RVC tightening.

### 🚦 Module 2 audit gate

Before proceeding to Module 3, all of these must pass:

| Check | Pass criterion |
|---|---|
| HS classifier accuracy on 50-item test set (mixed verticals) | ≥ 95% match against expert classification |
| GRI rule-application order correct | 100% (rule order is deterministic, no exceptions) |
| LIGIE table loaded | All 1,463 lines from DOF 5777376 present, hash-verified against published source |
| LIGIE flag accuracy on 50-item test set | 100% (lookup is deterministic) |
| USMCA tariff-shift validator on Annex 4-B test cases | ≥ 98% |
| RVC calculator (TV + NC) on 30 known-answer cases | 100% within $1 rounding |
| Certificate-of-origin USMCA Article 5.2 9-element generator | 100% field presence |
| Calibration_log writing on every chassis call | 100% (no silent dropped writes) |
| `npm run build` clean | Yes |
| `/api/ports` still returns 50+ ports (regression) | Yes |
| Bilingual coverage of new strings via `LangContext` | 100% |

**Audit method:** Sensei mode (per `feedback_sensei_audit_method`) — full reconciliation log appended to a Module-2-audit memory file before proceeding.

---

## Module 3 — Pre-arrival regulatory notification

Outbound notifications and pre-fills, built on the customs-trade-compliance skill (§Documentation Requirements: Commercial Invoice 19 CFR §141.86, Packing List, Certificate of Origin, BOL, ISF 10+2 12 elements, CBP 7501).

### 3.1 FDA Prior Notice (food/produce/medical)

**Required:** 2 hours pre-arrival for food. Some medical-device shipments require companion notice.
**Tech:** FDA Prior Notice System Interface (PNSI) — submission via FDA Industry Systems portal or direct API where available.
**Output:** FDA Prior Notice Confirmation Number stored in Ticket.

### 3.2 USDA APHIS

**Required:** for plant/animal products. PPQ Form 587 (plant inspection), 925 (origin certification).
**Tech:** USDA APHIS eFile portal or direct submission.
**Output:** APHIS reference number + status.

### 3.3 ISF 10+2 (Importer Security Filing)

**Required:** 24h before vessel loading at foreign port. 12 elements (10 from importer, 2 from carrier).
**Tech:** ABI (Automated Broker Interface) submission to CBP ACE.
**Output:** ISF transaction reference + accepted/rejected status.

### 3.4 CBP 7501 (Entry Summary) pre-fill

**Required:** within 10 business days of entry. Legal declaration — errors here create 19 USC §1592 penalty exposure.
**Tech:** CBP CATAIR (Customs and Trade Automated Interface Requirements) submission to ACE.
**Output:** Pre-filled CF-7501 ready for broker review + final filing; entry number captured into Ticket.

### Submitter routing

The `submitter.ts` decides which agency notices apply per shipment based on Module 2's HS classification + product type:
- Food/produce HS chapters 7-21 → FDA Prior Notice + (often) USDA APHIS
- Medical device HS chapter 90 → CBP 7501 + (sometimes) FDA companion
- Auto/maquila HS 87 → CBP 7501 + ISF 10+2 (if ocean)
- Vessel ocean → always ISF 10+2

### 🚦 Module 3 audit gate

| Check | Pass criterion |
|---|---|
| FDA Prior Notice submission success on 20-item test set | 100% with valid confirmation # |
| FDA 2-hour pre-arrival timing honored | 100% (deterministic — block submission if < 2h) |
| USDA APHIS Form 587/925 field population on 10-item test set | 100% field accuracy |
| ISF 10+2 — all 12 elements populated, 24h timing honored | 100% |
| CBP 7501 pre-fill matches Module 2 validation output | 100% (no mismatches) |
| Submitter routing correct on 30 mixed-vertical test shipments | ≥ 98% |
| Regulatory rejection handling — graceful + logged | 100% (no silent drops) |
| Calibration_log per submission | 100% |
| `npm run build` clean | Yes |
| Live curl `/api/regulatory/fda-prior-notice` returns expected schema | Yes |
| Bilingual coverage of new strings | 100% |

**Audit method:** Sensei mode reconciliation log appended.

---

## Module 4 — Paperwork scanner (`/paperwork`)

Intake layer. Different tech stack from Modules 2/3 because problem domain differs (parsing existing physical/scanned docs into structured data).

### 4.1 Document classifier

**Input:** uploaded PDF/image (single or multi-page).
**Output:** document type classification — commercial invoice / packing list / BOL / certificate of origin / health certificate / pedimento / other.
**Tech:** Claude Vision (primary), Tesseract (fallback for cost).

### 4.2 Field extractor

**Input:** classified document + page bounds.
**Output:** structured field map (per document type schema). For commercial invoice: seller, buyer, description, quantity, unit price, total value, currency, Incoterms, country of origin, payment terms (per 19 CFR §141.86).
**Tech:** Claude Vision with structured output schema.
**Confidence:** every field has confidence score; below threshold flags for human review.

### 4.3 Mexican health certificate validator (special case)

**Critical rule:** must be single-sided + no handwritten corrections (per Diego's research dump — 90% of paperwork errors involve this).
**Output:** single-sided yes/no, handwriting detected yes/no, scan integrity hash.
**Failure mode:** flag and block Ticket generation until valid cert provided.

### 4.4 Multi-page handling

**Input:** PDF with multiple containers / multiple BOLs / mixed-doc PDF.
**Output:** segmented per-document structured output.
**Tech:** layout detection + page classification chain.

### 4.5 Bilingual extraction

**Input:** EN/ES mixed docs (common: commercial invoice in English, packing list in Spanish, pedimento in Spanish).
**Output:** all fields normalized to canonical schema regardless of source language.

### 🚦 Module 4 audit gate

| Check | Pass criterion |
|---|---|
| Document classification on 50-item test set (mixed types) | ≥ 95% accuracy |
| Commercial invoice field extraction (14 fields) on 30-item test set | ≥ 95% per-field accuracy |
| Mexican health certificate single-sided detection | 100% on test set |
| Mexican health certificate handwriting detection | ≥ 98% |
| Multi-page handling on 20-item test set | 100% segmentation accuracy |
| Bilingual extraction on 20 mixed-language docs | ≥ 95% field-level normalization |
| Low-quality scan handling (under-exposed, skewed) | Graceful degradation + confidence reflects quality |
| Confidence-threshold flagging for human review | 100% (no false-pass on low-confidence) |
| Claude Vision cost per document | ≤ target (set during build) |
| `npm run build` clean | Yes |

**Audit method:** Sensei mode reconciliation log appended.

---

## Module 5 — Driver-side compliance (`/insights/drivers`)

Different audience inside the broker/maquila org (HR/comp, not dispatchers) → its own consumer surface. Same chassis pattern.

Lifts the Mexican labor law engine pattern from Laboral (the engine pattern preserved per `project_laboral_killed_20260502`; the standalone product killed because Worky/Buk own that wedge — but the engine fits Cruzar's freight context cleanly).

### 5.1 USMCA Annex 31-A labor obligations

**Required:** facility-level compliance with collective bargaining + freedom of association rules. Broker-side relevant when validating maquila supplier compliance.
**Tech:** STPS data integration + facility self-attestation form.
**Output:** compliant/non-compliant per shipment origin facility.

### 5.2 IMSS contributions (Mexican-side drivers)

**Required:** Mexican drivers must have IMSS (Instituto Mexicano del Seguro Social) coverage current.
**Tech:** IMSS web service or driver-side attestation + cross-check.
**Output:** current/lapsed status per driver assigned to shipment.

### 5.3 Hours of Service divergence (US vs MX)

**Critical:** US DOT FMCSA HOS rules (11h driving / 14h on-duty / 60-70h cycle) differ from Mexican equivalent (8h driving / 9h on-duty / 14h rest). Driver crossing border = both regimes potentially apply.
**Tech:** ELD (Electronic Logging Device) data ingestion + dual-regime calculator.
**Output:** within-limits per regime, divergence flag if US-clean but MX-foul (or vice versa).

### 5.4 Drug & alcohol testing

**Required:** 49 CFR Part 40 for US-side drivers; Mexican equivalent for MX-side. Equivalency mapping non-trivial.
**Tech:** test record validation + equivalency mapper.
**Output:** valid/expired per regime, last-test-date, equivalency confirmation.

### 5.5 Drayage W-2 vs 1099 classification (Borello test)

**Risk:** misclassified 1099 drayage drivers = $1M-$10M settlement risk per California PAGA / Dynamex precedent extended to Texas. Borello test factors: control, integration, skill, investment, opportunity for profit/loss, etc.
**Tech:** decision-tree against driver employment record.
**Output:** likely-classification + risk flag.

### 🚦 Module 5 audit gate

| Check | Pass criterion |
|---|---|
| USMCA Annex 31-A compliance check on 20 facility records | ≥ 95% accuracy vs ground truth |
| IMSS status check on 20 drivers | 100% (deterministic API) |
| HOS dual-regime calculator on 30 known-answer cases | 100% within 0.1h |
| HOS divergence flag (US-clean / MX-foul) on test cases | 100% |
| Drug-testing equivalency mapper on 20 cases | ≥ 98% |
| Borello-test drayage classification on 30 cases | ≥ 95% vs labor-counsel ground truth |
| Calibration_log per driver compliance call | 100% |
| `/insights/drivers` page renders bilingual EN/ES | 100% |
| `npm run build` clean | Yes |
| Bilingual coverage of new strings | 100% |

**Audit method:** Sensei mode reconciliation log appended.

---

## /insights hero rewrite (after Module 2 audit passes)

The page today sells "wait-time intelligence." That's a feature, not a product. The rewrite sells the trust layer.

### Hero (above the fold) — bilingual, no AI/model/MCP language

```
The trust layer for cross-border SMB.
La capa de confianza para PyMEs transfronterizas.

For freight brokers shipping under
LIGIE 2026, COFEPRIS reform, and the
USMCA review.

Every shipment gets a Cruzar Ticket —
HS classification, origin proof, RVC math,
regulatory submissions, paperwork validation,
driver compliance, and audit shield —
all signed before the truck leaves the dock.

[ Generate a Ticket → ]   [ See live accuracy → ]
```

### Below the hero

- **ROI math card** — "Your $100K produce load. Without us: 1-3% ($1K-3K) annually lost to errors. First avoided $50K negligence penalty pays years of Pro tier."
- **Live calibration scoreboard** — per-module accuracy, last 30 days
- **Public Ticket counter** — "X Tickets issued this month across Y brokers"
- **Before/after broker workflow** — diagrammed
- **Module pillars** — 5 cards: customs / regulatory / paperwork / drivers / wait-time, each with one-line value prop

### What's killed from the current page

- "Seven tools. One MCP endpoint." dev-marketing copy (already-killed pivot 2026-04-29; remnants remain)
- "Free trial Raul" copy (replace with "We'll text in" per Diego 2026-05-02)
- Any "AI-powered" / "Asistente AI" / model name copy (per guardrail + `feedback_ai_as_infrastructure_not_product_20260430`)
- 50-port pricing-tier framing (capability tiers replace usage tiers within the locked $99/$299/$999 structure)

---

## Calibration integration

Every chassis call across Modules 1-5 + Ticket signing writes to `calibration_log` with prediction, outcome, timestamp, delta. Customer-facing `/insights/accuracy` shows split per-module accuracy + 30-day rolling chart. Already 80% there per active queue.

---

## Pricing — tiers locked, capability mapping deferred

Per guardrails, B2B Insights pricing is confirmed: **Starter $99/mo · Pro $299/mo · Fleet $999/mo.** Tier prices NOT being changed in this spec.

Capability-to-tier mapping is decided **after each module ships and we have ~5 broker conversations on actual willingness-to-pay-per-feature.** Per Diego 2026-05-02: "we need to come back once we build and determine the true value of this." The capability mapping conversation lives outside this spec.

---

## Audit gates summary

Per Diego: build each individually + audit before next.

```
Module 2 build → 🚦 Module 2 audit → if pass →
Module 3 build → 🚦 Module 3 audit → if pass →
Module 4 build → 🚦 Module 4 audit → if pass →
Module 5 build → 🚦 Module 5 audit → if pass →
/insights hero rewrite + scoreboard finalized + Ticket layer finalized
```

If any audit fails: stop, reconcile, re-audit before continuing. Each audit produces a reconciliation log appended to its dedicated memory file (`project_cruzar_module_X_audit_YYYYMMDD.md`).

---

## Open questions (resolved or explicitly deferred)

1. **HS classifier ML vs rules-only vs hybrid.** First build = rules + CBP CROSS lookup. Claude-assisted classification with broker-feedback fine-tuning is a v2 question — Claude stays internal, never surfaced in customer copy.
2. **Ed25519 key management.** First version = single key on Vercel env var, public verification key in `/.well-known/`. Hardware-token rotation deferred.
3. **Bilingual PDF rendering.** Side-by-side EN/ES on one PDF, ES primary in body, EN parallel. Default chosen.
4. **LIGIE table maintenance cadence.** Manual first; `brain-weekly` cron eventually pulls.
5. **Broker-side data submission flow.** Form first, CSV upload v1.5.
6. **Capability-to-tier mapping** — decided post-each-module, not in this spec.
7. **Module 4 Claude Vision cost per document.** Set target during Module 4 build; if cost > target, fall back to Tesseract for high-volume paths.
8. **Module 5 ELD integration.** v1 = manual driver attestation form; v2 = direct ELD API integration (Geotab, Samsara, KeepTruckin most common).
9. **Module 3 agency rejection handling.** v1 = log + alert broker via existing notification path; v2 = automated re-submission with corrections.
10. **Module 5 W-2 vs 1099 classification — legal liability.** Cruzar provides flag, NOT legal opinion. Disclaimer on every Module 5 output: "Operational classification only; consult labor counsel for binding determination."

---

## Out of scope (deferred to separate plans)

- **Mexican-side data integrations beyond LIGIE + STPS + IMSS** — SAT pedimentos full integration, COFEPRIS dossier currency tracker, SAGARPA permits. Each is its own plan.
- **Push-notification fix** — URGENT in active queue but lives in `~/brain/raw/specs/cruzar-push-not-firing-diagnostic-20260502.md`.
- **Bilingual language toggle for /dispatch** — separate UI plan.
- **Stripe price IDs / cron-job.org registrations / OpenRouter env** — operational tasks in active queue, not design work.
- **Forward-deployed engineer model on the Mexican side** — Palantir-of-the-border thesis component, not a v1 build, comes after density.
- **Government / enterprise contract pursuit** — explicitly NOT pursued in v1; bottom-up SMB density first.

---

## Anti-goals

- **Not a TMS.** Doesn't replace Aljex, Magaya, CargoWise. Integrates as the customs/border layer.
- **Not a regulatory issuer.** Ticket = private operational record, not a CBP/SAT credential.
- **Not aimed at enterprise / government in v1.** Bottom-up SMB coalition first.
- **Not a wait-time-only product.** Wait-time is one of 5 modules; the product is the trust layer.
- **Not "AI for brokers" in customer copy.** Claude in the engine, never on the surface (per guardrail).

---

## Build order (no calendar — dependency + audit gates only)

1. **Foundation** — `lib/chassis/customs/types.ts` + `lib/ticket/types.ts`. Schema definitions.
2. **LIGIE table** — `lib/chassis/customs/ligie-flag.ts` loads DOF 5777376. THE wedge data.
3. **Module 2 build** — HS classifier → origin validator → RVC calculator → USMCA preference → `customs_validations` migration via `npm run apply-migration`.
4. **Ticket layer v1** — JSON signer + bilingual PDF + QR + verifier (Ticket has Module 2 data only at this point).
5. **API routes Module 2** — `/api/customs/*` + `/api/ticket/generate`.
6. **🚦 Module 2 audit** — pass criteria above. Reconciliation log saved.
7. **Module 3 build** — FDA Prior Notice → USDA APHIS → ISF 10+2 → CBP 7501 → submitter routing → `regulatory_submissions` migration.
8. **API routes Module 3** + Ticket bundle extends to include regulatory data.
9. **🚦 Module 3 audit** — pass criteria above. Reconciliation log saved.
10. **Module 4 build** — document classifier → field extractor → MX health cert validator → multi-page handler → bilingual extractor → `doc_extractions` migration.
11. **API routes Module 4** + `/paperwork` page + Ticket bundle extends to include paperwork data.
12. **🚦 Module 4 audit** — pass criteria above. Reconciliation log saved.
13. **Module 5 build** — USMCA Annex 31-A → IMSS → HOS divergence → drug testing → drayage 1099 → `driver_compliance` migration.
14. **API routes Module 5** + `/insights/drivers` page + Ticket bundle extends to include driver data.
15. **🚦 Module 5 audit** — pass criteria above. Reconciliation log saved.
16. **/insights hero rewrite** — published version landing all 5 modules.
17. **/insights/accuracy customer-facing scoreboard** — finalized split per-module view.

This order ensures the foundation (types + LIGIE table + chassis) is in place before any consumer surface is rebuilt. Each module ships behind an audit gate. The hero rewrite ships only after all 5 modules are audited — so customer copy is never lying about what's available.

---

## Spec self-review (per brainstorming skill)

**Placeholder scan:** No "TBD" or "TODO." Every section concrete or explicitly deferred to a named separate plan.

**Internal consistency:** Architecture, all 5 modules, Ticket layer, /insights, audit gates, build order all reference the same chassis pattern, same calibration hooks, same data flow. Pricing aligned with guardrails. No contradictions.

**Scope check:** Single implementation plan eligible — all 5 modules share chassis pattern + Ticket bundle composition. Tightly coupled. Modules 1 (existing wait-time) and 0 (Ticket layer cross-cutting) bracket Modules 2-5.

**Ambiguity check:** 10 open questions surfaced explicitly with default positions or defer-to-build markers. Capability-to-tier mapping explicitly deferred to post-each-module-ship. Nothing else interpretation-ambiguous.

**Guardrail check (Cruzar):** No Aguirre pairing. No FB auto-poster. No Nati / no page automation. No customer-facing AI/model/MCP language. Bilingual EN/ES standard. Migrations via `npm run apply-migration`. Pricing tiers $99/$299/$999 honored. No contradictions.

**Audit-gate completeness check:** Every module has explicit pass criteria, an audit method (Sensei mode), and a reconciliation-log destination. No module's audit references unresolvable criteria.

---

## Awaiting

Diego review of this v2 spec. Once approved, invoke `superpowers:writing-plans` to convert each module into its own implementation plan, executed sequentially with audit gates between.
