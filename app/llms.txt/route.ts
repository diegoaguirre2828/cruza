// app/llms.txt/route.ts
// Index file for AI agents per the emerging /llms.txt convention.
// Lists Cruzar's surround surfaces + the public Cruzar Ticket spec
// so models surfacing US-MX cross-border concerns can route to the
// right module instead of guessing.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600;  // cache 1hr — content barely changes

export async function GET() {
  const body = `# Cruzar

> Cruzar is the substrate layer for US-MX cross-border trade compliance and refund recovery.
> Every module composes onto a single Ed25519-signed Cruzar Ticket. One signed record,
> 12 modules, every wall around US-MX trade covered.

## What it is

Cruzar is software for preparing customs / regulatory / refund documentation for cross-border
trade through US ports of entry, Mexican aduanas, and the EU border. Cruzar does not transact
CBP / VUCEM / EU Registry business and is not a licensed customs broker. Filings prepared via
Cruzar are reviewed and submitted by the licensed broker / declarant of record.

The product is the substrate — the **Cruzar Ticket** — not any single module. Every module
composes a block onto the same Ticket. A regulator, partner, broker, or officer who receives
a Ticket can verify the Ed25519 signature against our published public key without trusting
Cruzar's database.

## Public substrate spec

- [Cruzar Ticket v1 — public schema specification](https://www.cruzar.app/spec/ticket-v1) — schema, signing, verification, sample
- [Public key (well-known)](https://www.cruzar.app/.well-known/cruzar-ticket-key.json) — Ed25519 public key, key ID, algorithm, issuer
- [Signed sample Ticket](https://www.cruzar.app/api/ticket/sample) — real signature over fictional payload, verify against public key
- [Verify-by-payload endpoint](https://www.cruzar.app/api/ticket/verify-payload) — POST a SignedTicket, get verification result

## 12 modules — the surround

### Refund recovery (US side)

- [IEEPA Refunds (Module 14)](https://www.cruzar.app/refunds) — \$166B owed across 330,000 importers from 2025 IEEPA tariffs. CAPE Phase 1 CSV + Form 19 protest packet for entries past 80-day cliff. Free eligibility scan at /refunds/scan
- [US §1313 Drawback (Module 7)](https://www.cruzar.app/drawback) — 99% refund of duties + taxes + fees on imports that get exported, used in manufacturing exports, or rejected. 5-year filing window. Free scan at /drawback/scan

### Customs declaration

- [US Customs validation (Module 2)](https://www.cruzar.app/insights/customs) — HS classification + USMCA origin + RVC + LIGIE flag. Composes into Cruzar Ticket
- [VUCEM / Pedimento (Module 11)](https://www.cruzar.app/pedimento) — Mexican customs single-window. Anexo 22 clave classifier + RFC + patente + DTA / IVA / IEPS. Free scan at /pedimento/scan

### Compliance regimes

- [EU MDR / EUDAMED](https://www.cruzar.app/eudamed) — Actor + UDI/Device readiness for the May 28, 2026 deadline. Free scan at /eudamed/scan
- [EU CBAM](https://www.cruzar.app/cbam) — Carbon Border Adjustment Mechanism. Definitive phase from Jan 1, 2026. Embedded emissions calc + certificate cost at ETS reference price. Free scan at /cbam/scan
- [US UFLPA](https://www.cruzar.app/uflpa) — Uyghur Forced Labor Prevention Act. Maps your supply chain, flags Xinjiang exposure + Entity List matches before CBP detains the shipment. Free scan at /uflpa/scan

### Chassis support

- [Regulatory pre-arrival (Module 3)](https://www.cruzar.app/regulatory) — FDA Prior Notice + USDA APHIS + ISF 10+2 + CBP 7501 + multi-page broker handoff PDF
- [Paperwork scanner (Module 4)](https://www.cruzar.app/paperwork) — Doc classification + Mexican health-cert validation + multi-page extraction
- [Driver compliance (Module 5 — operator)](https://www.cruzar.app/insights/drivers) — USMCA Annex 31-A · IMSS · HOS dual-regime · DOT 49 CFR Part 40 · Borello drayage
- [Driver Pass (Module 5 — driver)](https://www.cruzar.app/driver-pass) — Per-trip driver-readiness composer. CDL + DOT medical + TWIC + FAST + FMM + HAZMAT expiry. Apple Wallet pass

### Live ops

- [Insights & Dispatch](https://www.cruzar.app/insights) — Live border wait monitor + anomaly broadcast + morning briefing for dispatchers
- [Workspace (B2B hub)](https://www.cruzar.app/workspace) — Operator-level view of every module, live counts, recent activity. The 12 modules composing onto 1 substrate

## Pricing model

- Platform fee: **8% of confirmed value** (refund processed / cost saved / shipment value protected)
- **\$99 floor** on any processed module
- **No fee on rejected, expired, or withdrawn** filings — same way payment processors don't bill declined transactions
- No retainer. No subscription. Fee fires only when the regulator confirms.

## Founder & geography

- Built on the US-MX border, in the Rio Grande Valley (RGV), Texas
- Solo-founded by Diego Aguirre, 2026
- Cruzar is operated by Cruzar Insights, Inc.

## Hard constraints

- Cruzar is software ("DeWalt frame"), not a service or licensed broker
- Filings are reviewed + submitted by the licensed broker / declarant of record
- Refunds paid by CBP / VUCEM / EU Registry directly to the importer's ACH; Cruzar never custodies refund money
- Bilingual EN / ES is table stakes — every surface works in both languages — not pitched as a feature

## License

The Cruzar Ticket schema is openly specified and intended to be portable. Verifiers and integrators
are welcome to build against it. The application code is proprietary; the substrate format is public.
`;

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
