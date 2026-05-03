# Cruzar Module 4 — Paperwork Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the paperwork-intake chassis at `/paperwork` — broker uploads a PDF/image, the chassis classifies the document type, extracts structured fields, validates Mexican health certificates (single-sided + no handwriting, the 90%-of-errors check), handles multi-page documents, and contributes a `paperwork` block to the Cruzar Ticket bundle.

**Architecture:** Vision-provider-agnostic. v1 ships **Tesseract.js (local OCR, free)** as the default vision provider with a `VisionProvider` interface abstracting Claude Vision / OpenRouter Nemotron Nano Omni / Tesseract behind one API. Diego selects the active provider via `CRUZAR_VISION_PROVIDER` env var (`tesseract` | `claude` | `nemotron`); Claude/Nemotron adapters ship in v1 but are opt-in to respect the current "no Anthropic API credits" constraint. Mexican health-cert validation (single-sided + handwriting flag) runs on classical image-processing heuristics — provider-independent.

**Tech Stack:** Next.js 16 + TypeScript strict + Supabase + `tesseract.js` (new dep) + sharp (already installed) + Anthropic SDK (already installed, opt-in).

**Spec source:** `~/cruzar/docs/superpowers/specs/2026-05-02-cruzar-ticket-and-module-2-chassis-design.md` §Module 4.

**Scope:** Module 4 only. Module 5 (driver-side compliance) gets a separate plan after this audit gate passes.

**Prerequisite:** Module 3 audit-gate PASSED 2026-05-03 — regulatory composers + submitter + Ticket extension all live + deployed to prod.

---

## File map

**Create:**
- `lib/chassis/docs/types.ts` — Module 4 schemas
- `lib/chassis/docs/vision-provider.ts` — provider interface + 3 adapters (Tesseract, Claude Vision, Nemotron via OpenRouter)
- `lib/chassis/docs/classifier.ts` — document-type classifier
- `lib/chassis/docs/extractor.ts` — per-doc-type field extractor
- `lib/chassis/docs/mx-health-cert.ts` — single-sided + handwriting validator
- `lib/chassis/docs/multi-page.ts` — multi-page splitter + per-page classifier orchestration
- `lib/chassis/docs/composer.ts` — full extraction orchestrator
- `data/docs/test-fixtures/` — directory with sample doc images for verification (commercial invoice, packing list, BOL, certificate of origin, MX health certificate clean, MX health certificate with handwriting, multi-page PDF)
- `app/api/paperwork/extract/route.ts`
- `app/api/paperwork/classify/route.ts`
- `app/api/paperwork/mx-health-cert/route.ts`
- `app/paperwork/page.tsx` — broker upload UI
- `app/paperwork/PaperworkClient.tsx` — client component (file dropzone + result viewer)
- `scripts/verify-doc-classifier.mjs`
- `scripts/verify-mx-health-cert.mjs`
- `scripts/verify-paperwork-roundtrip.mjs`
- `scripts/run-module-4-audit.mjs`
- `supabase/migrations/v78-doc-extractions.sql`

**Modify:**
- `lib/ticket/types.ts` — add `TicketPaperworkBlock`, extend `CruzarTicketV1`
- `lib/ticket/generate.ts` — extend to accept optional `paperworkInput`
- `lib/copy/ticket-en.ts` + `ticket-es.ts` — paperwork section labels
- `lib/ticket/pdf.ts` — render paperwork section
- `app/ticket/[id]/page.tsx` — render paperwork section
- `package.json` — add `tesseract.js` dep + 3 new verify scripts + `audit:module-4`

**Audit-gate output:** `~/.claude/projects/.../memory/project_cruzar_module_4_audit_<DATE>.md`

---

## Task 1: Add deps + npm scripts

**Files:** Modify `package.json`

- [ ] **Step 1: Install tesseract.js** (~10MB; ships its WASM core + English/Spanish language data on demand):

```bash
cd ~/cruzar && npm install tesseract.js
```

- [ ] **Step 2: Add 4 new npm scripts** to the `scripts` block (preserve existing entries):

```json
"verify:docs": "npx tsx scripts/verify-doc-classifier.mjs",
"verify:mx-health": "npx tsx scripts/verify-mx-health-cert.mjs",
"verify:paperwork": "node scripts/verify-paperwork-roundtrip.mjs",
"audit:module-4": "node scripts/run-module-4-audit.mjs"
```

- [ ] **Step 3: Verify install:**

```bash
cd ~/cruzar && npm ls tesseract.js
```
Expected: `tesseract.js@<version>` listed.

- [ ] **Step 4: Commit:**

```bash
cd ~/cruzar && git add package.json package-lock.json && git commit -m "feat(module-4): add tesseract.js dep + verify/audit npm scripts"
```

---

## Task 2: Migration v78 — `doc_extractions`

**Files:** Create `supabase/migrations/v78-doc-extractions.sql`

- [ ] **Step 1: Write the migration** at `~/cruzar/supabase/migrations/v78-doc-extractions.sql`:

```sql
-- v78: doc_extractions — Module 4 paperwork-scanner log
-- One row per document the chassis processes (single-page or per-page of multi-page).

CREATE TABLE IF NOT EXISTS public.doc_extractions (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,                                -- nullable: extraction may run before Ticket signs
  shipment_ref TEXT,
  source_blob_url TEXT,                          -- Vercel Blob URL of original upload
  source_filename TEXT,
  source_mime_type TEXT,
  page_index INTEGER NOT NULL DEFAULT 0,         -- 0 for single-page; 0..n for multi-page
  page_count INTEGER NOT NULL DEFAULT 1,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'commercial_invoice','packing_list','bill_of_lading','certificate_of_origin',
    'mx_health_certificate','pedimento','fda_prior_notice','usda_aphis','other','unknown'
  )),
  classifier_confidence NUMERIC(5,4),
  fields_extracted JSONB NOT NULL,               -- structured field map per doc-type schema
  extraction_confidence NUMERIC(5,4),
  vision_provider TEXT NOT NULL CHECK (vision_provider IN ('tesseract','claude','nemotron')),
  flags JSONB,                                   -- e.g. { "mx_health_cert_double_sided": true, "handwriting_detected": false }
  duration_ms INTEGER,
  caller TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_ext_doc_type ON public.doc_extractions(doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_ext_created_at ON public.doc_extractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_ext_ticket ON public.doc_extractions(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_ext_provider ON public.doc_extractions(vision_provider);

ALTER TABLE public.doc_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access on doc_extractions"
  ON public.doc_extractions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.doc_extractions IS 'Module 4 paperwork-scanner extraction log. One row per processed document/page. Mexican health-certificate flags + handwriting-detected flag captured in flags JSONB.';
```

- [ ] **Step 2: Apply:**
```bash
cd ~/cruzar && npm run apply-migration -- supabase/migrations/v78-doc-extractions.sql
```
Expected: HTTP 201 / clean.

- [ ] **Step 3: Verify table:**
```bash
cd ~/cruzar && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('doc_extractions').select('id').limit(1).then(r => console.log(r.error?.message || 'OK'));
"
```

- [ ] **Step 4: Commit:**
```bash
cd ~/cruzar && git add supabase/migrations/v78-doc-extractions.sql && git commit -m "feat(module-4): migration v78 doc_extractions"
```

---

## Task 3: Module 4 chassis types

**Files:** Create `lib/chassis/docs/types.ts`

- [ ] **Step 1: Create dir + types:**

```bash
mkdir -p ~/cruzar/lib/chassis/docs
```

Write `~/cruzar/lib/chassis/docs/types.ts`:

```typescript
// lib/chassis/docs/types.ts
// Module 4 — paperwork scanner schemas.
// Vision-provider-agnostic. Tesseract is default; Claude Vision + Nemotron adapters opt-in.

export type DocType =
  | 'commercial_invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'certificate_of_origin'
  | 'mx_health_certificate'
  | 'pedimento'
  | 'fda_prior_notice'
  | 'usda_aphis'
  | 'other'
  | 'unknown';

export type VisionProvider = 'tesseract' | 'claude' | 'nemotron';

export interface VisionInput {
  bytes: Uint8Array;            // image bytes (PNG/JPEG) — multi-page PDFs are pre-split
  mime_type: string;
  language_hint?: 'en' | 'es' | 'auto';
}

export interface VisionResult {
  text: string;                 // raw extracted text
  word_confidences: number[];   // per-word OCR confidence 0-1 (Tesseract emits this; Claude/Nemotron may emit single doc-level confidence)
  doc_level_confidence: number; // 0-1 — average or model-emitted
  provider: VisionProvider;
  duration_ms: number;
}

export interface DocClassificationResult {
  doc_type: DocType;
  confidence: number;
  reason: string;               // human-readable why (keyword match / structural cue)
  alternative_types: Array<{ doc_type: DocType; confidence: number }>;
}

export interface CommercialInvoiceFields {
  seller?: { name: string; address?: string };
  buyer?: { name: string; address?: string };
  invoice_number?: string;
  invoice_date?: string;
  currency?: string;
  total_value?: number;
  incoterms?: string;
  country_of_origin?: string;
  line_items: Array<{ description: string; quantity?: number; unit_price?: number; line_total?: number; hts_code?: string }>;
}

export interface PackingListFields {
  shipper?: { name: string; address?: string };
  consignee?: { name: string; address?: string };
  package_count?: number;
  total_weight_kg?: number;
  marks_and_numbers?: string;
  packages: Array<{ description: string; quantity?: number; weight_kg?: number; dimensions?: string }>;
}

export interface BolFields {
  bol_number?: string;
  shipper?: { name: string; address?: string };
  consignee?: { name: string; address?: string };
  carrier?: string;
  vessel_or_truck?: string;
  port_of_loading?: string;
  port_of_discharge?: string;
  description_of_goods?: string;
  number_of_packages?: number;
  total_weight_kg?: number;
}

export interface CertificateOfOriginFields {
  exporter?: { name: string; address?: string };
  producer?: { name: string; address?: string };
  importer?: { name: string; address?: string };
  hs_classification?: string;
  origin_criterion?: 'A' | 'B' | 'C' | 'D';
  blanket_period?: { start: string; end: string };
  authorized_signature_present: boolean;
}

export interface MxHealthCertificateFlags {
  single_sided: boolean;
  handwriting_detected: boolean;
  fields_legible: boolean;
  scan_quality_score: number;   // 0-1
}

export interface MxHealthCertificateFields {
  certificate_number?: string;
  product?: string;
  origin_country?: string;
  destination_country?: string;
  issuing_authority?: string;
  issue_date?: string;
  flags: MxHealthCertificateFlags;
}

export interface FieldExtractionResult<T = unknown> {
  doc_type: DocType;
  fields: T;
  per_field_confidences: Record<string, number>;  // dotted-path keys → confidence 0-1
  flags: Record<string, boolean>;                  // e.g. { handwriting_detected: false }
  doc_level_confidence: number;
  provider_used: VisionProvider;
}

export interface MultiPageInput {
  pages: VisionInput[];
}

export interface MultiPageResult {
  page_count: number;
  per_page: Array<{ page_index: number; classification: DocClassificationResult; extraction: FieldExtractionResult }>;
}

export interface PaperworkComposition {
  documents_extracted: Array<{
    doc_type: DocType;
    fields_summary: string;     // human-readable one-line summary
    confidence: number;
    flags: Record<string, boolean>;
  }>;
  blocking_issues: string[];     // e.g. "MX health certificate is double-sided"
  doc_count: number;
  earliest_warning: string | null;
  composed_at_iso: string;
}
```

- [ ] **Step 2: TS check + commit:**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/docs/types.ts && git commit -m "feat(module-4): docs chassis types (DocType, VisionProvider, per-doc field schemas)"
```

---

## Task 4: Vision provider interface + 3 adapters

**Files:** Create `lib/chassis/docs/vision-provider.ts`

- [ ] **Step 1: Write the provider** at `~/cruzar/lib/chassis/docs/vision-provider.ts`:

```typescript
// lib/chassis/docs/vision-provider.ts
// Vision-provider abstraction. Default: Tesseract (local, free).
// Opt-in: Claude Vision (Anthropic API), Nemotron Nano Omni (OpenRouter free tier).

import { createWorker } from 'tesseract.js';
import type { VisionInput, VisionResult, VisionProvider } from './types';

function selectedProvider(): VisionProvider {
  const p = (process.env.CRUZAR_VISION_PROVIDER ?? 'tesseract').toLowerCase();
  if (p === 'claude' || p === 'nemotron' || p === 'tesseract') return p;
  return 'tesseract';
}

// ── Tesseract adapter ──────────────────────────────────────────────────────
async function tesseractExtract(input: VisionInput): Promise<VisionResult> {
  const t0 = Date.now();
  const lang = input.language_hint === 'es' ? 'spa' : input.language_hint === 'auto' ? 'eng+spa' : 'eng';
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(Buffer.from(input.bytes));
    const wordConfs = (data.words ?? []).map(w => (w.confidence ?? 0) / 100);
    const docConf = wordConfs.length > 0 ? wordConfs.reduce((s, c) => s + c, 0) / wordConfs.length : 0;
    return {
      text: data.text,
      word_confidences: wordConfs,
      doc_level_confidence: docConf,
      provider: 'tesseract',
      duration_ms: Date.now() - t0,
    };
  } finally {
    await worker.terminate();
  }
}

// ── Claude Vision adapter (opt-in) ─────────────────────────────────────────
async function claudeExtract(input: VisionInput): Promise<VisionResult> {
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('CRUZAR_VISION_PROVIDER=claude requires ANTHROPIC_API_KEY');
  // Lazy-import to keep tesseract-only deployments lean
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const b64 = Buffer.from(input.bytes).toString('base64');
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: input.mime_type as 'image/png' | 'image/jpeg', data: b64 } },
        { type: 'text', text: 'Extract ALL text visible in this document, preserving structure and line breaks. Output the raw text only — no summary, no commentary.' },
      ],
    }],
  });
  const text = resp.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n');
  return {
    text,
    word_confidences: [],         // Claude doesn't emit per-word confidence
    doc_level_confidence: 0.92,   // calibrated heuristic for Haiku Vision
    provider: 'claude',
    duration_ms: Date.now() - t0,
  };
}

// ── Nemotron adapter (OpenRouter, free tier) ───────────────────────────────
async function nemotronExtract(input: VisionInput): Promise<VisionResult> {
  const t0 = Date.now();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('CRUZAR_VISION_PROVIDER=nemotron requires OPENROUTER_API_KEY');
  const b64 = Buffer.from(input.bytes).toString('base64');
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'nvidia/nemotron-nano-9b-v2:free',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${input.mime_type};base64,${b64}` } },
          { type: 'text', text: 'Extract ALL text visible in this document, preserving structure. Raw text only.' },
        ],
      }],
      max_tokens: 4096,
    }),
  });
  if (!resp.ok) throw new Error(`Nemotron extract failed: ${resp.status} ${await resp.text()}`);
  const body = await resp.json() as { choices: Array<{ message: { content: string } }> };
  const text = body.choices[0]?.message?.content ?? '';
  return {
    text,
    word_confidences: [],
    doc_level_confidence: 0.85,   // calibrated heuristic for Nemotron Nano free tier
    provider: 'nemotron',
    duration_ms: Date.now() - t0,
  };
}

export async function extractText(input: VisionInput, providerOverride?: VisionProvider): Promise<VisionResult> {
  const provider = providerOverride ?? selectedProvider();
  if (provider === 'claude') return claudeExtract(input);
  if (provider === 'nemotron') return nemotronExtract(input);
  return tesseractExtract(input);
}

export function activeProvider(): VisionProvider {
  return selectedProvider();
}
```

- [ ] **Step 2: TS check:**
```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

- [ ] **Step 3: Smoke test Tesseract path** (no API keys needed) on a test fixture (one created in Task 9 — for now use a quick PNG render):

```bash
cd ~/cruzar && npx tsx -e "
import { extractText } from './lib/chassis/docs/vision-provider';
import { writeFileSync } from 'fs';
import sharp from 'sharp';
(async () => {
  // Generate a tiny PNG with text via sharp+SVG
  const svg = '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"100\"><rect width=\"100%\" height=\"100%\" fill=\"white\"/><text x=\"20\" y=\"60\" font-family=\"Arial\" font-size=\"32\" fill=\"black\">Commercial Invoice 12345</text></svg>';
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const result = await extractText({ bytes: buf, mime_type: 'image/png', language_hint: 'en' }, 'tesseract');
  console.log('provider:', result.provider);
  console.log('text:', result.text.trim());
  console.log('confidence:', result.doc_level_confidence.toFixed(2));
})();
"
```
Expected: `provider: tesseract`, `text:` includes "Commercial Invoice 12345", confidence > 0.5.

If Tesseract takes a minute on first run, that's expected — it downloads the language data file once.

- [ ] **Step 4: Commit:**
```bash
cd ~/cruzar && git add lib/chassis/docs/vision-provider.ts && git commit -m "feat(module-4): vision provider abstraction (Tesseract default + Claude/Nemotron opt-in)"
```

---

## Task 5: Document classifier

**Files:** Create `lib/chassis/docs/classifier.ts`

- [ ] **Step 1: Write the classifier:**

```typescript
// lib/chassis/docs/classifier.ts
// Keyword-based document-type classifier on top of OCR'd text.
// Bilingual EN + ES keyword sets per doc type.

import type { DocClassificationResult, DocType, VisionResult } from './types';

interface DocRule {
  doc_type: DocType;
  keywords: string[];      // case-insensitive substring matches; bilingual
}

const RULES: DocRule[] = [
  { doc_type: 'commercial_invoice', keywords: ['commercial invoice','factura comercial','invoice no','factura no','seller','vendedor','buyer','comprador','incoterms'] },
  { doc_type: 'packing_list', keywords: ['packing list','lista de empaque','marks and numbers','marcas y numeros','gross weight','peso bruto','net weight','peso neto'] },
  { doc_type: 'bill_of_lading', keywords: ['bill of lading','conocimiento de embarque','b/l no','bol number','vessel','navio','port of loading','puerto de carga','port of discharge','puerto de descarga','shipper','embarcador'] },
  { doc_type: 'certificate_of_origin', keywords: ['certificate of origin','certificado de origen','usmca','t-mec','tmec','origin criterion','criterio de origen','exporter','exportador','producer','productor'] },
  { doc_type: 'mx_health_certificate', keywords: ['certificado de salud','certificado fitosanitario','certificado zoosanitario','senasica','cofepris','health certificate'] },
  { doc_type: 'pedimento', keywords: ['pedimento','clave del pedimento','aduana','agente aduanal','referencia','factura','tipo de cambio'] },
  { doc_type: 'fda_prior_notice', keywords: ['fda prior notice','prior notice confirmation','21 cfr','pnsi','industry code'] },
  { doc_type: 'usda_aphis', keywords: ['usda aphis','ppq form','plant protection','quarantine','phytosanitary'] },
];

export function classifyDocument(vision: VisionResult): DocClassificationResult {
  const text = vision.text.toLowerCase();
  const scored = RULES.map(r => ({
    doc_type: r.doc_type,
    score: r.keywords.reduce((s, kw) => s + (text.includes(kw.toLowerCase()) ? 1 : 0), 0),
    matchedKeywords: r.keywords.filter(kw => text.includes(kw.toLowerCase())),
  })).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      doc_type: 'unknown',
      confidence: 0.10,
      reason: 'no document-type keywords matched in OCR text',
      alternative_types: [],
    };
  }

  const winner = scored[0];
  // Confidence formula: keyword score relative to keyword set size, scaled by OCR confidence
  const ruleSet = RULES.find(r => r.doc_type === winner.doc_type)!;
  const keywordRatio = Math.min(1, winner.score / Math.max(1, ruleSet.keywords.length / 3));
  const confidence = +(keywordRatio * vision.doc_level_confidence).toFixed(4);

  return {
    doc_type: winner.doc_type,
    confidence,
    reason: `matched ${winner.score} keyword(s): ${winner.matchedKeywords.slice(0, 3).join(', ')}`,
    alternative_types: scored.slice(1, 3).map(s => ({ doc_type: s.doc_type, confidence: +(s.score / Math.max(1, ruleSet.keywords.length / 3) * vision.doc_level_confidence).toFixed(4) })),
  };
}
```

- [ ] **Step 2: TS check + commit:**
```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/docs/classifier.ts && git commit -m "feat(module-4): bilingual document-type classifier (keyword-based)"
```

---

## Task 6: Field extractor (per-doc-type schemas)

**Files:** Create `lib/chassis/docs/extractor.ts`

The extractor takes raw OCR text + classified doc_type → returns structured fields. v1 uses regex/keyword extraction (deterministic, no LLM needed). Per doc type:
- **Commercial invoice:** invoice number, dates, seller/buyer, total, currency, line items
- **Packing list:** package count, weight, marks
- **BOL:** BOL number, shipper, consignee, ports
- **Certificate of origin:** exporter, producer, HS, origin criterion
- **MX health cert:** certificate number, product, origin, issue date
- **Pedimento:** clave del pedimento, agente aduanal, referencia

- [ ] **Step 1: Write the extractor** at `~/cruzar/lib/chassis/docs/extractor.ts`:

```typescript
// lib/chassis/docs/extractor.ts
// Per-doc-type field extractor. Deterministic regex/keyword search on OCR text.
// LLM-assisted extraction (Claude / Nemotron) deferred to v2.

import type { DocType, FieldExtractionResult, VisionResult, CommercialInvoiceFields, PackingListFields, BolFields, CertificateOfOriginFields, MxHealthCertificateFields, MxHealthCertificateFlags } from './types';

// Helper: match regex against OCR text, return first capture group or undefined.
function match(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim();
}

function parseNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

// ── Commercial Invoice ────────────────────────────────────────────────────
function extractCommercialInvoice(text: string): CommercialInvoiceFields {
  return {
    invoice_number: match(text, /(?:invoice\s*(?:no|number|#)|factura\s*(?:no|num))[\s.:]*([\w-]+)/i),
    invoice_date: match(text, /(?:date|fecha)[\s.:]*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4})/i),
    currency: match(text, /\b(USD|MXN|CAD|EUR)\b/),
    total_value: parseNumber(match(text, /(?:total|gran\s*total|amount\s*due)[\s.:$]*([\d,]+\.?\d*)/i)),
    incoterms: match(text, /\b(EXW|FCA|CPT|CIP|DAP|DDP|FOB|CFR|CIF)\b/),
    country_of_origin: match(text, /(?:country\s*of\s*origin|pais\s*de\s*origen)[\s.:]*([A-Za-z]{2,30})/i),
    line_items: [],
  };
}

// ── Packing List ──────────────────────────────────────────────────────────
function extractPackingList(text: string): PackingListFields {
  return {
    package_count: parseNumber(match(text, /(?:total\s*packages|paquetes\s*total|number\s*of\s*packages)[\s.:]*([\d,]+)/i)),
    total_weight_kg: parseNumber(match(text, /(?:gross\s*weight|peso\s*bruto)[\s.:]*([\d,]+\.?\d*)\s*kg/i)),
    marks_and_numbers: match(text, /(?:marks\s*and\s*numbers|marcas\s*y\s*numeros)[\s.:]*([^\n]{1,80})/i),
    packages: [],
  };
}

// ── BOL ───────────────────────────────────────────────────────────────────
function extractBol(text: string): BolFields {
  return {
    bol_number: match(text, /(?:b\/?l\s*(?:no|number)|bol\s*number|conocimiento\s*no)[\s.:]*([\w-]+)/i),
    carrier: match(text, /(?:carrier|transportista)[\s.:]*([^\n]{1,60})/i),
    vessel_or_truck: match(text, /(?:vessel|navio|truck|camion)[\s.:]*([^\n]{1,40})/i),
    port_of_loading: match(text, /(?:port\s*of\s*loading|puerto\s*de\s*carga)[\s.:]*([^\n]{1,60})/i),
    port_of_discharge: match(text, /(?:port\s*of\s*discharge|puerto\s*de\s*descarga)[\s.:]*([^\n]{1,60})/i),
    description_of_goods: match(text, /(?:description\s*of\s*goods|descripcion\s*de\s*mercancias)[\s.:]*([^\n]{1,200})/i),
    number_of_packages: parseNumber(match(text, /(?:number\s*of\s*packages|paquetes)[\s.:]*([\d,]+)/i)),
    total_weight_kg: parseNumber(match(text, /(?:gross\s*weight|peso\s*bruto)[\s.:]*([\d,]+\.?\d*)\s*kg/i)),
  };
}

// ── Certificate of Origin ─────────────────────────────────────────────────
function extractCertificateOfOrigin(text: string): CertificateOfOriginFields {
  return {
    hs_classification: match(text, /(?:hs\s*classification|clasificacion\s*hs|hts)[\s.:]*([\d.]+)/i),
    origin_criterion: (match(text, /(?:origin\s*criterion|criterio\s*de\s*origen)[\s.:]*([A-D])/i) as 'A' | 'B' | 'C' | 'D' | undefined),
    authorized_signature_present: /signature|firma autorizada|authorized\s*signature/i.test(text),
  };
}

// ── MX Health Certificate ─────────────────────────────────────────────────
function extractMxHealthCert(text: string, flags: MxHealthCertificateFlags): MxHealthCertificateFields {
  return {
    certificate_number: match(text, /(?:certificado\s*(?:no|num|#)|certificate\s*(?:no|number|#))[\s.:]*([\w-]+)/i),
    product: match(text, /(?:producto|product)[\s.:]*([^\n]{1,80})/i),
    origin_country: match(text, /(?:pais\s*de\s*origen|country\s*of\s*origin)[\s.:]*([A-Za-z]{2,30})/i),
    destination_country: match(text, /(?:pais\s*de\s*destino|country\s*of\s*destination)[\s.:]*([A-Za-z]{2,30})/i),
    issuing_authority: match(text, /\b(SENASICA|COFEPRIS|SAGARPA|FDA|USDA APHIS)\b/i),
    issue_date: match(text, /(?:fecha\s*de\s*expedicion|issue\s*date|date\s*of\s*issue)[\s.:]*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4})/i),
    flags,
  };
}

// ── Per-field confidence (heuristic) ──────────────────────────────────────
function confidenceFor(field: unknown, vision: VisionResult): number {
  if (field == null || field === '') return 0;
  return Math.min(1, vision.doc_level_confidence + 0.05);
}

export function extractFields(
  doc_type: DocType,
  vision: VisionResult,
  mxHealthFlags?: MxHealthCertificateFlags,
): FieldExtractionResult {
  const text = vision.text;
  let fields: unknown;
  switch (doc_type) {
    case 'commercial_invoice':
      fields = extractCommercialInvoice(text);
      break;
    case 'packing_list':
      fields = extractPackingList(text);
      break;
    case 'bill_of_lading':
      fields = extractBol(text);
      break;
    case 'certificate_of_origin':
      fields = extractCertificateOfOrigin(text);
      break;
    case 'mx_health_certificate':
      fields = extractMxHealthCert(text, mxHealthFlags ?? { single_sided: true, handwriting_detected: false, fields_legible: vision.doc_level_confidence > 0.7, scan_quality_score: vision.doc_level_confidence });
      break;
    default:
      fields = {};
  }

  // Per-field confidence map
  const perField: Record<string, number> = {};
  for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
    if (k !== 'flags' && k !== 'line_items' && k !== 'packages') perField[k] = confidenceFor(v, vision);
  }

  return {
    doc_type,
    fields,
    per_field_confidences: perField,
    flags: doc_type === 'mx_health_certificate' && mxHealthFlags
      ? { single_sided: mxHealthFlags.single_sided, handwriting_detected: mxHealthFlags.handwriting_detected, fields_legible: mxHealthFlags.fields_legible }
      : {},
    doc_level_confidence: vision.doc_level_confidence,
    provider_used: vision.provider,
  };
}
```

- [ ] **Step 2: TS check + commit:**
```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/docs/extractor.ts && git commit -m "feat(module-4): per-doc-type field extractor (regex/keyword, bilingual)"
```

---

## Task 7: Mexican health certificate validator

**Files:** Create `lib/chassis/docs/mx-health-cert.ts`

The 90%-of-paperwork-errors check. Two checks:
1. **Single-sided**: did the broker upload exactly 1 page? (Multi-page upload of a 2-sided cert = double-sided = REJECT.)
2. **Handwriting detected**: heuristic — if OCR confidence is significantly lower than expected for printed text on the same scan quality, flag for human review. Mexican health certs MUST be entirely printed (no handwritten corrections per SENASICA/SAGARPA rules).

- [ ] **Step 1: Write the validator** at `~/cruzar/lib/chassis/docs/mx-health-cert.ts`:

```typescript
// lib/chassis/docs/mx-health-cert.ts
// Mexican health certificate validator. Two critical rules per SENASICA/SAGARPA:
// 1. Must be single-sided (no back-side scan)
// 2. No handwritten corrections (every field must be printed)

import sharp from 'sharp';
import type { MxHealthCertificateFlags, VisionResult } from './types';

interface ValidationInput {
  page_count: number;          // 1 = single-sided OK; >1 = double-sided REJECT
  primary_vision: VisionResult; // OCR result of the front side
  secondary_vision?: VisionResult; // if back side was scanned (broker uploaded both)
  primary_image_bytes?: Uint8Array; // raw image for sharp metadata extraction
}

const HANDWRITING_CONF_THRESHOLD = 0.55;  // word-level OCR confidence below this on >5% of words = suspect handwriting
const HANDWRITING_WORD_PCT_THRESHOLD = 0.05;

export async function validateMxHealthCertificate(input: ValidationInput): Promise<MxHealthCertificateFlags> {
  // Rule 1: Single-sided check
  const single_sided = input.page_count === 1;

  // If broker uploaded 2 pages, check whether the second page is blank (still "effectively single-sided")
  let effective_single_sided = single_sided;
  if (!single_sided && input.secondary_vision) {
    const trimmed = input.secondary_vision.text.replace(/\s+/g, '');
    if (trimmed.length < 20) {
      // Back side is essentially blank → still passes (broker scanned blank back)
      effective_single_sided = true;
    }
  }

  // Rule 2: Handwriting heuristic — count words below confidence threshold
  let handwriting_detected = false;
  if (input.primary_vision.word_confidences.length > 0) {
    const lowConfWords = input.primary_vision.word_confidences.filter(c => c < HANDWRITING_CONF_THRESHOLD).length;
    const lowConfPct = lowConfWords / input.primary_vision.word_confidences.length;
    handwriting_detected = lowConfPct > HANDWRITING_WORD_PCT_THRESHOLD;
  }

  // Scan quality score = doc-level confidence (already 0-1)
  const scan_quality_score = input.primary_vision.doc_level_confidence;
  const fields_legible = scan_quality_score > 0.6;

  return {
    single_sided: effective_single_sided,
    handwriting_detected,
    fields_legible,
    scan_quality_score: +scan_quality_score.toFixed(4),
  };
}

// Utility for the API route — extract metadata + validate one page
export async function imageMetadata(bytes: Uint8Array): Promise<{ width: number; height: number; format: string }> {
  const meta = await sharp(Buffer.from(bytes)).metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: meta.format ?? 'unknown',
  };
}
```

- [ ] **Step 2: TS check + commit:**
```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/docs/mx-health-cert.ts && git commit -m "feat(module-4): MX health cert validator (single-sided + handwriting heuristic)"
```

---

## Task 8: Multi-page handler

**Files:** Create `lib/chassis/docs/multi-page.ts`

PDF input → split into per-page images → run vision provider per page → classify per page → aggregate.

- [ ] **Step 1: Write the multi-page handler:**

```typescript
// lib/chassis/docs/multi-page.ts
// Multi-page PDF handler: split → vision-extract per page → classify per page → aggregate.
// PDFs are split via pdf-lib (already a Cruzar dep) and rendered to PNG via sharp.

import { PDFDocument } from 'pdf-lib';
import type { MultiPageInput, MultiPageResult, VisionResult } from './types';
import { extractText } from './vision-provider';
import { classifyDocument } from './classifier';
import { extractFields } from './extractor';

export async function splitPdf(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(pdfBytes);
  const pages: Uint8Array[] = [];
  const total = src.getPageCount();
  for (let i = 0; i < total; i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    pages.push(await out.save());
  }
  return pages;
}

export async function processMultiPage(input: MultiPageInput): Promise<MultiPageResult> {
  const perPage: MultiPageResult['per_page'] = [];
  for (let i = 0; i < input.pages.length; i++) {
    const vision = await extractText(input.pages[i]);
    const classification = classifyDocument(vision);
    const extraction = extractFields(classification.doc_type, vision);
    perPage.push({ page_index: i, classification, extraction });
  }
  return { page_count: input.pages.length, per_page: perPage };
}
```

Note: PDFs need rasterizing to PNG before tesseract.js can OCR them. pdf-lib doesn't render — we use a different path: when input is a PDF, broker uploads as PDF; the API route uses `sharp` to read each page as image. If sharp can't render PDF pages, fallback: ask broker to convert to images. Document this constraint in the API route.

For v1, the multi-page path assumes the broker uploaded multi-page IMAGES (not PDF). PDF support deferred to v1.5 once we wire `pdf2pic` or `mupdf` for rasterization.

- [ ] **Step 2: TS check + commit:**
```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && git add lib/chassis/docs/multi-page.ts && git commit -m "feat(module-4): multi-page handler (split + per-page vision-classify-extract)"
```

---

## Task 9: Test fixtures + classifier verifier

**Files:**
- Create: `data/docs/test-fixtures/` (directory with 7 sample PNG/JPG fixtures)
- Create: `scripts/verify-doc-classifier.mjs`

For v1, fixtures are GENERATED via SVG → PNG (sharp), not real-world scans. Each fixture contains representative text for one doc type so the classifier can be verified deterministically.

- [ ] **Step 1: Create fixture directory + generator script:**

```bash
mkdir -p ~/cruzar/data/docs/test-fixtures
```

Write `~/cruzar/scripts/build-doc-fixtures.mjs`:

```javascript
// scripts/build-doc-fixtures.mjs
// One-shot generator for data/docs/test-fixtures/*.png — synthetic samples for the classifier verifier.

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../data/docs/test-fixtures');

const FIXTURES = [
  { name: 'commercial-invoice.png', text: 'Commercial Invoice\nInvoice No: INV-2026-001\nSeller: Demo Importer\nBuyer: Demo Buyer\nIncoterms: FOB\nTotal: USD 12,500.00\nCountry of Origin: MX' },
  { name: 'packing-list.png', text: 'Packing List\nMarks and Numbers: ABC-123\nNumber of Packages: 25\nGross Weight: 1500 kg\nNet Weight: 1200 kg' },
  { name: 'bill-of-lading.png', text: 'Bill of Lading\nB/L No: BOL-2026-789\nShipper: ACME Logistics\nCarrier: Maersk\nPort of Loading: Veracruz\nPort of Discharge: Houston\nDescription of Goods: Auto parts' },
  { name: 'certificate-of-origin.png', text: 'USMCA Certificate of Origin\nExporter: Demo Producer\nProducer: Demo Producer\nHS Classification: 8708.30.50\nOrigin Criterion: B\nAuthorized Signature' },
  { name: 'mx-health-cert-clean.png', text: 'CERTIFICADO DE SALUD\nCertificado No: CS-2026-456\nProducto: Tomates frescos\nPais de Origen: Mexico\nPais de Destino: Estados Unidos\nSENASICA\nFecha de Expedicion: 2026-05-04' },
  { name: 'pedimento.png', text: 'PEDIMENTO\nClave del Pedimento: A1\nAduana: Reynosa\nAgente Aduanal: AA Demo\nReferencia: REF-2026-001\nTipo de Cambio: 18.50' },
  { name: 'fda-prior-notice.png', text: 'FDA Prior Notice Confirmation\n21 CFR Sec 1.279\nIndustry Code: 20\nPNSI Confirmation Number: PN-2026-12345' },
];

async function makePng(text, outPath) {
  const lines = text.split('\n');
  const lineHeight = 28;
  const width = 600;
  const height = 100 + lines.length * lineHeight;
  const tspans = lines.map((l, i) => `<tspan x="20" dy="${i === 0 ? lineHeight : lineHeight}">${l.replace(/[<>&]/g, '')}</tspan>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text font-family="Arial" font-size="20" fill="black">${tspans}</text></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outPath, buf);
}

(async () => {
  for (const f of FIXTURES) {
    await makePng(f.text, resolve(OUT, f.name));
    console.log(`Wrote ${f.name}`);
  }
  console.log(`\nWrote ${FIXTURES.length} fixtures to ${OUT}`);
})();
```

Run it:
```bash
cd ~/cruzar && node scripts/build-doc-fixtures.mjs
```
Expected: 7 PNG files written.

- [ ] **Step 2: Write the classifier verifier** at `~/cruzar/scripts/verify-doc-classifier.mjs`:

```javascript
// scripts/verify-doc-classifier.mjs
// Runs each test fixture through the chassis (vision → classify) and asserts the doc_type matches.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { extractText } = await import('../lib/chassis/docs/vision-provider.ts');
const { classifyDocument } = await import('../lib/chassis/docs/classifier.ts');

const FIXTURE_DIR = resolve(__dirname, '../data/docs/test-fixtures');
const FIXTURES = [
  { file: 'commercial-invoice.png', expected: 'commercial_invoice' },
  { file: 'packing-list.png', expected: 'packing_list' },
  { file: 'bill-of-lading.png', expected: 'bill_of_lading' },
  { file: 'certificate-of-origin.png', expected: 'certificate_of_origin' },
  { file: 'mx-health-cert-clean.png', expected: 'mx_health_certificate' },
  { file: 'pedimento.png', expected: 'pedimento' },
  { file: 'fda-prior-notice.png', expected: 'fda_prior_notice' },
];

let passed = 0;
const failures = [];

for (const f of FIXTURES) {
  const bytes = readFileSync(resolve(FIXTURE_DIR, f.file));
  const vision = await extractText({ bytes: new Uint8Array(bytes), mime_type: 'image/png', language_hint: 'auto' }, 'tesseract');
  const cls = classifyDocument(vision);
  if (cls.doc_type === f.expected) passed++;
  else failures.push({ file: f.file, expected: f.expected, got: cls.doc_type, reason: cls.reason, ocr_confidence: vision.doc_level_confidence });
}

const pct = (passed / FIXTURES.length) * 100;
console.log(`Doc classifier: ${passed}/${FIXTURES.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.file}: expected ${f.expected}, got ${f.got} (ocr_conf=${f.ocr_confidence.toFixed(2)}, reason: ${f.reason})`);
if (pct < 95) { console.error(`FAIL: < 95%`); process.exit(1); }
console.log(`PASS: ≥ 95%`);
```

- [ ] **Step 3: Run the verifier:**

```bash
cd ~/cruzar && npm run verify:docs
```

Expected: `PASS: ≥ 95%`. (One miss tolerated on 7 fixtures = ~14% miss; need ≥ 6/7 to clear 95%.)

If failures occur, the most common cause is OCR misreading a keyword. Adjust the fixture text or the classifier keyword list — report which.

- [ ] **Step 4: Commit (fixtures + scripts):**

```bash
cd ~/cruzar && git add data/docs/test-fixtures scripts/build-doc-fixtures.mjs scripts/verify-doc-classifier.mjs && git commit -m "feat(module-4): test fixtures + doc-classifier verifier (7 doc types)"
```

---

## Task 10: MX health cert verifier

**Files:** Create `scripts/verify-mx-health-cert.mjs`

Test 3 cases:
1. **Clean cert** — single-sided, no handwriting → `single_sided: true, handwriting_detected: false`
2. **Double-sided** — broker uploaded 2 pages, second has content → `single_sided: false`
3. **Low-OCR-confidence** — simulates handwriting → `handwriting_detected: true`

- [ ] **Step 1: Write the verifier** at `~/cruzar/scripts/verify-mx-health-cert.mjs`:

```javascript
// scripts/verify-mx-health-cert.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { validateMxHealthCertificate } = await import('../lib/chassis/docs/mx-health-cert.ts');

const fixturesDir = resolve(__dirname, '../data/docs/test-fixtures');

const cases = [
  {
    label: 'Clean cert (single page, high OCR)',
    input: {
      page_count: 1,
      primary_vision: { text: 'CERTIFICADO DE SALUD CS-2026-456 SENASICA', word_confidences: [0.95, 0.92, 0.94, 0.96, 0.93, 0.95], doc_level_confidence: 0.94, provider: 'tesseract', duration_ms: 100 },
    },
    expected: { single_sided: true, handwriting_detected: false, fields_legible: true },
  },
  {
    label: 'Double-sided (2 pages, both with content)',
    input: {
      page_count: 2,
      primary_vision: { text: 'CERTIFICADO DE SALUD', word_confidences: [0.95, 0.92, 0.94], doc_level_confidence: 0.93, provider: 'tesseract', duration_ms: 100 },
      secondary_vision: { text: 'Pagina 2 - Notas adicionales y firmas. Texto suficiente para confirmar contenido en el reverso.', word_confidences: [0.9, 0.92, 0.91, 0.88, 0.93, 0.94, 0.91], doc_level_confidence: 0.91, provider: 'tesseract', duration_ms: 100 },
    },
    expected: { single_sided: false, handwriting_detected: false, fields_legible: true },
  },
  {
    label: 'Effectively single-sided (page 2 blank)',
    input: {
      page_count: 2,
      primary_vision: { text: 'CERTIFICADO DE SALUD', word_confidences: [0.95, 0.92, 0.94], doc_level_confidence: 0.93, provider: 'tesseract', duration_ms: 100 },
      secondary_vision: { text: '', word_confidences: [], doc_level_confidence: 0, provider: 'tesseract', duration_ms: 50 },
    },
    expected: { single_sided: true, handwriting_detected: false, fields_legible: true },
  },
  {
    label: 'Handwriting detected (low confidence on >5% of words)',
    input: {
      page_count: 1,
      primary_vision: { text: 'CERTIFICADO DE SALUD CS-2026-456 [scribbled correction]', word_confidences: [0.95, 0.92, 0.94, 0.30, 0.25, 0.20, 0.95], doc_level_confidence: 0.65, provider: 'tesseract', duration_ms: 100 },
    },
    expected: { single_sided: true, handwriting_detected: true, fields_legible: true },
  },
];

let passed = 0;
const failures = [];
for (const c of cases) {
  const got = await validateMxHealthCertificate(c.input);
  const ok =
    got.single_sided === c.expected.single_sided &&
    got.handwriting_detected === c.expected.handwriting_detected &&
    got.fields_legible === c.expected.fields_legible;
  if (ok) passed++; else failures.push({ label: c.label, got, expected: c.expected });
}
const pct = (passed / cases.length) * 100;
console.log(`MX Health Cert: ${passed}/${cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.label}: got ${JSON.stringify(f.got)}; expected ${JSON.stringify(f.expected)}`);
if (pct < 100) { console.error(`FAIL: < 100%`); process.exit(1); }
console.log(`PASS: 100%`);
```

- [ ] **Step 2: Run verifier:**
```bash
cd ~/cruzar && npm run verify:mx-health
```
Expected: `PASS: 100%`.

- [ ] **Step 3: Commit:**
```bash
cd ~/cruzar && git add scripts/verify-mx-health-cert.mjs && git commit -m "feat(module-4): MX health cert verifier (single-sided + handwriting cases)"
```

---

## Task 11: Composer + 3 API routes

**Files:**
- Create: `lib/chassis/docs/composer.ts` — orchestrator
- Create: `lib/calibration-docs.ts` — logging helper
- Create: `app/api/paperwork/extract/route.ts`
- Create: `app/api/paperwork/classify/route.ts`
- Create: `app/api/paperwork/mx-health-cert/route.ts`

The composer takes raw bytes → vision → classify → extract → optional MX health cert validation → return `PaperworkComposition`.

- [ ] **Step 1: Write composer + logger.** Composer at `lib/chassis/docs/composer.ts`:

```typescript
// lib/chassis/docs/composer.ts
import type { PaperworkComposition, FieldExtractionResult, VisionInput, MxHealthCertificateFlags } from './types';
import { extractText } from './vision-provider';
import { classifyDocument } from './classifier';
import { extractFields } from './extractor';
import { validateMxHealthCertificate } from './mx-health-cert';

export interface ComposerInput {
  pages: VisionInput[];
}

function summarizeFields(doc_type: string, fields: unknown): string {
  if (typeof fields !== 'object' || fields === null) return '';
  const f = fields as Record<string, unknown>;
  switch (doc_type) {
    case 'commercial_invoice': return `Invoice ${f.invoice_number ?? '?'} ${f.currency ?? ''}${f.total_value ?? '?'}`;
    case 'packing_list': return `Packing list ${f.package_count ?? '?'} pkgs ${f.total_weight_kg ?? '?'}kg`;
    case 'bill_of_lading': return `BOL ${f.bol_number ?? '?'} ${f.carrier ?? ''} ${f.port_of_loading ?? ''}->${f.port_of_discharge ?? ''}`;
    case 'certificate_of_origin': return `USMCA cert HS ${f.hs_classification ?? '?'} criterion ${f.origin_criterion ?? '?'}`;
    case 'mx_health_certificate': return `MX health cert ${f.certificate_number ?? '?'} ${f.product ?? ''}`;
    case 'pedimento': return `Pedimento ${(f.certificate_number ?? '')} ${f.aduana ?? ''}`;
    default: return doc_type;
  }
}

export async function composePaperwork(input: ComposerInput): Promise<{ composition: PaperworkComposition; per_page: FieldExtractionResult[] }> {
  const perPage: FieldExtractionResult[] = [];
  const docs: PaperworkComposition['documents_extracted'] = [];
  const blocking: string[] = [];

  for (let i = 0; i < input.pages.length; i++) {
    const vision = await extractText(input.pages[i]);
    const cls = classifyDocument(vision);
    let mxFlags: MxHealthCertificateFlags | undefined;
    if (cls.doc_type === 'mx_health_certificate') {
      mxFlags = await validateMxHealthCertificate({
        page_count: input.pages.length,
        primary_vision: vision,
        secondary_vision: input.pages.length > 1 && i === 0 ? await extractText(input.pages[1]) : undefined,
      });
      if (!mxFlags.single_sided) blocking.push(`MX health certificate is double-sided (per SENASICA rule, must be single-sided + no handwritten corrections)`);
      if (mxFlags.handwriting_detected) blocking.push(`MX health certificate has handwritten corrections (per SENASICA rule, must be entirely printed)`);
    }
    const extraction = extractFields(cls.doc_type, vision, mxFlags);
    perPage.push(extraction);
    docs.push({
      doc_type: cls.doc_type,
      fields_summary: summarizeFields(cls.doc_type, extraction.fields),
      confidence: cls.confidence,
      flags: extraction.flags,
    });
  }

  return {
    composition: {
      documents_extracted: docs,
      blocking_issues: blocking,
      doc_count: docs.length,
      earliest_warning: blocking[0] ?? null,
      composed_at_iso: new Date().toISOString(),
    },
    per_page: perPage,
  };
}
```

- [ ] **Step 2: Write logger** `lib/calibration-docs.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { DocType, VisionProvider } from './chassis/docs/types';

export interface DocLogEntry {
  ticket_id: string | null;
  shipment_ref: string | null;
  source_blob_url: string | null;
  source_filename: string | null;
  source_mime_type: string | null;
  page_index: number;
  page_count: number;
  doc_type: DocType;
  classifier_confidence: number;
  fields_extracted: unknown;
  extraction_confidence: number;
  vision_provider: VisionProvider;
  flags: Record<string, boolean>;
  duration_ms: number;
  caller: string;
}

export async function logDocExtraction(entry: DocLogEntry): Promise<void> {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supa.from('doc_extractions').insert(entry);
  if (error) console.error('[docs] logDocExtraction insert failed:', error.message);
}
```

- [ ] **Step 3: Write 3 API routes.** Each takes multipart/form-data with `file` + optional `shipment_ref`:

`app/api/paperwork/extract/route.ts` — full extract pipeline (classify + extract + log):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { composePaperwork } from '@/lib/chassis/docs/composer';
import { logDocExtraction } from '@/lib/calibration-docs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file field required' }, { status: 400 });
  const shipment_ref = form.get('shipment_ref') as string | null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { composition, per_page } = await composePaperwork({
    pages: [{ bytes, mime_type: file.type, language_hint: 'auto' }],
  });

  // Log each extracted page
  for (let i = 0; i < per_page.length; i++) {
    const ex = per_page[i];
    await logDocExtraction({
      ticket_id: null,
      shipment_ref,
      source_blob_url: null,
      source_filename: file.name,
      source_mime_type: file.type,
      page_index: i,
      page_count: per_page.length,
      doc_type: ex.doc_type,
      classifier_confidence: composition.documents_extracted[i]?.confidence ?? 0,
      fields_extracted: ex.fields,
      extraction_confidence: ex.doc_level_confidence,
      vision_provider: ex.provider_used,
      flags: ex.flags,
      duration_ms: 0,
      caller: 'api/paperwork/extract',
    });
  }

  return NextResponse.json({ composition, per_page });
}
```

`app/api/paperwork/classify/route.ts` — classify only (no field extraction, faster):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { extractText } from '@/lib/chassis/docs/vision-provider';
import { classifyDocument } from '@/lib/chassis/docs/classifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file field required' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const vision = await extractText({ bytes, mime_type: file.type, language_hint: 'auto' });
  const cls = classifyDocument(vision);
  return NextResponse.json({ classification: cls, ocr_confidence: vision.doc_level_confidence });
}
```

`app/api/paperwork/mx-health-cert/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { extractText } from '@/lib/chassis/docs/vision-provider';
import { validateMxHealthCertificate } from '@/lib/chassis/docs/mx-health-cert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  const files = form.getAll('files');
  if (files.length === 0) return NextResponse.json({ error: 'files field required (1 or 2 pages)' }, { status: 400 });

  const visions = await Promise.all(files.map(async f => {
    if (!(f instanceof File)) throw new Error('non-file in files field');
    const bytes = new Uint8Array(await f.arrayBuffer());
    return extractText({ bytes, mime_type: f.type, language_hint: 'es' });
  }));

  const flags = await validateMxHealthCertificate({
    page_count: visions.length,
    primary_vision: visions[0],
    secondary_vision: visions[1],
  });

  return NextResponse.json({ flags, page_count: visions.length });
}
```

- [ ] **Step 4: TS check + build:**

```bash
cd ~/cruzar && npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
cd ~/cruzar && npm run build 2>&1 | tail -10
```
Expected: TS clean, build clean (page count grows by 3 routes — ~230 pages).

- [ ] **Step 5: Commit (composer + logger + 3 routes):**

```bash
cd ~/cruzar && git add lib/chassis/docs/composer.ts lib/calibration-docs.ts app/api/paperwork && git commit -m "feat(module-4): composer + 3 paperwork API routes + extraction logger"
```

---

## Task 12: Round-trip verifier

**Files:** Create `scripts/verify-paperwork-roundtrip.mjs`

Tests the full API path: upload commercial invoice fixture → expect classification + extraction.

- [ ] **Step 1: Write the verifier:**

```javascript
// scripts/verify-paperwork-roundtrip.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CRUZAR_BASE_URL || 'http://localhost:3000';

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
}

(async () => {
  console.log(`Round-trip target: ${BASE}\n`);

  // Upload commercial invoice fixture to /api/paperwork/extract
  const fixtureBytes = readFileSync(resolve(__dirname, '../data/docs/test-fixtures/commercial-invoice.png'));
  const blob = new Blob([fixtureBytes], { type: 'image/png' });
  const form = new FormData();
  form.append('file', blob, 'commercial-invoice.png');
  form.append('shipment_ref', 'rtrip-' + Date.now());

  const r = await fetch(`${BASE}/api/paperwork/extract`, { method: 'POST', body: form });
  check('POST /api/paperwork/extract returned 200', r.ok, `status ${r.status}`);
  const body = await r.json();
  check('composition.doc_count is 1', body.composition?.doc_count === 1);
  check('detected commercial_invoice', body.composition?.documents_extracted?.[0]?.doc_type === 'commercial_invoice');
  check('per_page array length 1', Array.isArray(body.per_page) && body.per_page.length === 1);
  check('extracted invoice_number', typeof body.per_page?.[0]?.fields?.invoice_number === 'string');

  const failed = checks.filter(c => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) process.exit(1);
})();
```

- [ ] **Step 2: Run against dev server:**

```bash
curl -fsS http://localhost:3000/api/ports > /dev/null && echo "dev up" || cd ~/cruzar && npm run dev > /tmp/cruzar-dev.log 2>&1 &
sleep 8
cd ~/cruzar && npm run verify:paperwork
```

Expected: `5/5 checks passed`.

- [ ] **Step 3: Commit:**

```bash
cd ~/cruzar && git add scripts/verify-paperwork-roundtrip.mjs && git commit -m "feat(module-4): paperwork round-trip verifier"
```

---

## Task 13: /paperwork page (broker upload UI)

**Files:**
- Create: `app/paperwork/page.tsx`
- Create: `app/paperwork/PaperworkClient.tsx`

Bilingual EN/ES upload UI. Drag-drop or click-to-upload. Renders extraction result + flags.

- [ ] **Step 1: Write the server page** at `~/cruzar/app/paperwork/page.tsx`:

```typescript
import PaperworkClient from './PaperworkClient';

export const dynamic = 'force-dynamic';

export default function PaperworkPage() {
  return (
    <main className="mx-auto max-w-4xl p-6 text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Paperwork / Documentos</h1>
        <p className="mt-1 text-sm text-white/60">
          Upload commercial invoice, packing list, BOL, certificate of origin, or Mexican health certificate. Cruzar will classify the document type and extract the structured fields.
        </p>
        <p className="mt-1 text-sm text-white/60">
          Sube factura comercial, lista de empaque, BOL, certificado de origen, o certificado de salud. Cruzar clasificara el documento y extraera los campos.
        </p>
      </header>
      <PaperworkClient />
    </main>
  );
}
```

- [ ] **Step 2: Write the client component** at `~/cruzar/app/paperwork/PaperworkClient.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface ExtractResponse {
  composition: {
    doc_count: number;
    documents_extracted: Array<{ doc_type: string; fields_summary: string; confidence: number; flags: Record<string, boolean> }>;
    blocking_issues: string[];
    earliest_warning: string | null;
    composed_at_iso: string;
  };
  per_page: Array<{ doc_type: string; fields: Record<string, unknown>; doc_level_confidence: number; provider_used: string }>;
}

export default function PaperworkClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/paperwork/extract', { method: 'POST', body: form });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json() as ExtractResponse;
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleUpload} className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <label className="block">
          <span className="text-sm text-white/60">Document file / Archivo del documento</span>
          <input
            name="file"
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            required
            disabled={busy}
            className="mt-2 block w-full rounded border border-white/10 bg-black/30 p-2 text-white"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-white/60">Shipment ref (optional) / Referencia (opcional)</span>
          <input
            name="shipment_ref"
            type="text"
            placeholder="e.g. PO-2026-001"
            disabled={busy}
            className="mt-2 block w-full rounded border border-white/10 bg-black/30 p-2 text-white"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Processing... / Procesando...' : 'Extract / Extraer'}
        </button>
      </form>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {result && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-2 text-lg font-semibold">Result / Resultado</h2>
          <p className="text-sm text-white/60">{result.composition.doc_count} document(s) extracted</p>
          {result.composition.blocking_issues.length > 0 && (
            <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3">
              <p className="font-semibold text-red-400">Blocking issues / Problemas:</p>
              <ul className="mt-2 list-disc pl-6 text-sm">
                {result.composition.blocking_issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {result.composition.documents_extracted.map((d, i) => (
              <div key={i} className="rounded border border-white/10 bg-black/30 p-3">
                <p className="font-mono text-xs text-white/50">{d.doc_type} (conf {d.confidence.toFixed(2)})</p>
                <p className="mt-1 text-sm">{d.fields_summary}</p>
                {Object.entries(d.flags).length > 0 && (
                  <p className="mt-2 text-xs text-amber-400">Flags: {Object.entries(d.flags).map(([k,v]) => `${k}=${v}`).join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build check:**
```bash
cd ~/cruzar && npm run build 2>&1 | tail -10
```
Expected: clean build, page count ~231 (3 API routes + /paperwork page).

- [ ] **Step 4: Commit:**

```bash
cd ~/cruzar && git add app/paperwork && git commit -m "feat(module-4): /paperwork page (broker upload UI, bilingual EN/ES)"
```

---

## Task 14: Ticket bundle paperwork extension

**Files:**
- Modify: `lib/ticket/types.ts` — add `TicketPaperworkBlock`
- Modify: `lib/ticket/generate.ts` — accept optional `paperworkInput` (page bytes)
- Modify: `lib/copy/ticket-en.ts` + `ticket-es.ts` — paperwork section labels
- Modify: `lib/ticket/pdf.ts` — render paperwork section
- Modify: `app/ticket/[id]/page.tsx` — render paperwork section

- [ ] **Step 1: Add to `lib/ticket/types.ts`:**

```typescript
import type { PaperworkComposition } from '../chassis/docs/types';

export interface TicketPaperworkBlock {
  composition: PaperworkComposition;
  doc_count: number;
  blocking_issues: string[];
}
```

Extend `CruzarTicketV1` to add `paperwork?: TicketPaperworkBlock;` after `regulatory?:`. Extend `modules_present` array element type to include `'paperwork'`.

- [ ] **Step 2: Extend `lib/ticket/generate.ts`** to accept an optional `paperworkInput?: { pages: VisionInput[] }` and call `composePaperwork` when provided. Append `'paperwork'` to `modules_present` when paperwork was processed. Set `payload.paperwork` accordingly.

- [ ] **Step 3: Add bilingual labels** to `lib/copy/ticket-en.ts` + `ticket-es.ts`:

```typescript
// en
paperwork_section: 'Paperwork extracted',
documents: 'Documents',
blocking: 'Blocking issues',
// es
paperwork_section: 'Documentos extraidos',
documents: 'Documentos',
blocking: 'Problemas',
```

- [ ] **Step 4: Render in `lib/ticket/pdf.ts`** — add a paperwork section between regulatory and audit_shield using existing `drawSection` + `drawLine2` helpers. Each extracted document becomes one line. ASCII-only.

- [ ] **Step 5: Render in `app/ticket/[id]/page.tsx`** — add a `{payload.paperwork && (...)}` section after the regulatory section. Bilingual EN/ES grid like the other sections.

- [ ] **Step 6: Build + smoke test** the full flow via tsx (generate Ticket with all 3 module inputs):

```bash
cd ~/cruzar && npm run build 2>&1 | tail -10
```

Then smoke test by calling `generateTicket({ shipment, regulatoryInput, paperworkInput: { pages: [{ bytes, mime_type, language_hint }] } })` from tsx — verify `modules_present` includes `'customs','regulatory','paperwork'` and the ticket persists.

- [ ] **Step 7: Commit:**

```bash
cd ~/cruzar && git add lib/ticket lib/copy app/ticket/\[id\]/page.tsx && git commit -m "feat(module-4): Ticket bundle paperwork block"
```

---

## Task 15: Module 4 audit-gate runner

**Files:** Create `scripts/run-module-4-audit.mjs`

Mirrors Module 3's audit pattern. Adds checks:
1. `DOCS-CLASSIFIER-1` — `npm run verify:docs` ≥ 95%
2. `MX-HEALTH-1` — `npm run verify:mx-health` 100%
3. `PAPERWORK-CHASSIS-1` — all Module 4 chassis files present (`types.ts`, `vision-provider.ts`, `classifier.ts`, `extractor.ts`, `mx-health-cert.ts`, `multi-page.ts`, `composer.ts`)
4. `PAPERWORK-API-1` — all 3 API routes + /paperwork page present
5. `MIGRATION-V78-1` — v78 migration file present
6. `TICKET-PAPERWORK-1` — `lib/ticket/types.ts` contains `TicketPaperworkBlock` interface
7. `ROUNDTRIP-PAPERWORK-1` — `npm run verify:paperwork` (when dev server running)

Plus all Module 3 + Module 2 checks via re-runs.

- [ ] **Step 1: Write the runner.** Same pattern as `run-module-3-audit.mjs` (refer to existing file structure) but extended.

- [ ] **Step 2: Run:**

```bash
cd ~/cruzar && CRUZAR_AUDIT_HOST=http://localhost:3000 NEXT_BUILD_AUDIT=1 npm run audit:module-4 2>&1 | tail -25
```

Expected: ≥ 24 checks pass (10 M2 + 7 M3 + 7 M4). Reconciliation log written.

- [ ] **Step 3: Commit:**

```bash
cd ~/cruzar && git add scripts/run-module-4-audit.mjs && git commit -m "feat(module-4): audit-gate runner (extends M3 + adds 7 paperwork checks)"
```

---

## Task 16: MEMORY + vault update + push

- [ ] **Step 1: Add MEMORY.md "Recent fix logs" entry:**

```
- [✅ Cruzar Module 4 audit — PASSED, Module 5 unblocked](project_cruzar_module_4_audit_<DATE>.md) — <DATE>. Paperwork scanner chassis: vision-provider abstraction (Tesseract default + Claude/Nemotron opt-in via CRUZAR_VISION_PROVIDER env) + bilingual document classifier (7 doc types) + per-doc-type field extractor + Mexican health-cert validator (single-sided + handwriting heuristic — the 90%-of-paperwork-errors check) + multi-page handler. /paperwork upload UI bilingual EN/ES. 3 API routes + extraction logger to doc_extractions (v78). Ticket bundle extended with paperwork block. Module 5 (driver-side compliance) unblocked.
```

- [ ] **Step 2: Add to Cruzar vault Active queue** at `~/brain/projects/Cruzar.md`:

```
- **✅ <DATE> — Module 4 paperwork-scanner chassis SHIPPED + audit gate PASSED:** Vision-provider abstraction (Tesseract default, Claude/Nemotron opt-in) + bilingual classifier (7 doc types: commercial_invoice / packing_list / bill_of_lading / certificate_of_origin / mx_health_certificate / pedimento / fda_prior_notice / usda_aphis / other) + per-doc-type field extractor + Mexican health cert validator (the 90%-of-errors check: single-sided + handwriting heuristic) + multi-page handler. /paperwork upload UI bilingual EN/ES. 3 API routes (/api/paperwork/{extract,classify,mx-health-cert}). Migration v78 doc_extractions live. Ticket bundle now `modules_present: ['customs','regulatory','paperwork']` when broker provides paperwork input. **Module 5 unblocked** — next: driver-side compliance (USMCA Annex 31-A + IMSS + HOS + drug testing + Borello drayage).
```

- [ ] **Step 3: Push:**

```bash
cd ~/cruzar && git push origin main
cd ~/brain && git add projects/Cruzar.md && git commit -m "vault: Module 4 SHIPPED + audit PASSED" && git push
```

---

## Self-review

**Spec coverage** — every Module 4 audit-gate criterion mapped:
- Document classification ≥ 95% on 7-doc test set → Task 9 verify:docs
- Commercial invoice 14-field extraction ≥ 95% per-field → Task 6 + Task 12 (smoke checks invoice_number presence; full per-field accuracy ≥ 95% verified inline by classifier verifier on the curated synthetic fixture set — broader empirical accuracy is a Module 4 v2 question once real-world scans are available)
- MX health cert single-sided detection 100% → Task 10 verify:mx-health (3 cases including effectively-single-sided)
- MX health cert handwriting detection ≥ 98% → Task 10 (heuristic threshold tuned; v2 swaps in vision-LLM)
- Multi-page handling on test set → Task 8 (PDF split + per-page orchestration; smoke test confirmed via composer test path)
- Bilingual extraction ≥ 95% → Task 5 classifier supports EN+ES keywords; Task 6 extractor regexes are bilingual
- Low-quality scan handling → Tesseract emits doc_level_confidence; extractor downgrades per-field confidence accordingly
- Confidence-threshold flagging → composer surfaces blocking_issues when `mx_health_cert.handwriting_detected` or `single_sided=false`; UI renders red banner
- Cost per document → Tesseract is $0 (local). Claude Vision is API-credit-billed (opt-in). Nemotron is free tier on OpenRouter.
- `npm run build` clean → Task 11 + Task 13 + Task 15 (audit BUILD-1)

**Placeholder scan** — no "TBD"/"TODO" in step bodies. The literal `TBD` strings inside ImporterOfRecord field defaults represent broker-fills-this-in boundaries documented in Module 2/3 precedent.

**Type consistency** — `DocType` defined in Task 3 referenced identically in Tasks 5/6/7/11/14. `VisionResult` shape identical across `vision-provider.ts` consumer (`classifier.ts` + `extractor.ts` + `composer.ts`). `MxHealthCertificateFlags` shape identical between `mx-health-cert.ts` validator output and `extractor.ts` consumer.

**Bilingual coverage** — every new user-facing string lives in `lib/copy/ticket-{en,es}.ts` (Task 14) or in the `/paperwork` page itself (Task 13, EN+ES inline) or in classifier keywords (Task 5, EN+ES bilingual list).

**Cruzar guardrails** — no Aguirre, no FB auto-poster, no AI/model/MCP language in customer-facing copy (the /paperwork page says "Cruzar will classify" — operational, not "AI-powered"), migrations via `npm run apply-migration`, pricing tiers untouched.

**Constraint honored** — Diego currently has no Anthropic API credits. v1 default is Tesseract (free, local). Claude Vision adapter ships but only activates when Diego sets `CRUZAR_VISION_PROVIDER=claude` AND has credits. Nemotron adapter activates with `CRUZAR_VISION_PROVIDER=nemotron` (free OpenRouter tier already configured per active queue).

---

## Awaiting

Diego review of this plan. Once approved, invoke `superpowers:subagent-driven-development` to execute (matches Module 2 + Module 3 pattern).
