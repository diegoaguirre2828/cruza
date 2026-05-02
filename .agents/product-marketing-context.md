# Product Marketing Context — Cruzar
**Paste this file into `~/cruzar/.agents/product-marketing-context.md` so all `cm-*` Corey Haines marketing skills auto-load it.**

## Product
**Cruzar** — border-crossing intelligence app for the US-Mexico Rio Grande Valley (RGV). Live wait times at every RGV port (Pharr, Hidalgo, Brownsville, Anzalduas, Donna, Progreso, Los Indios, Rio Grande City, Falcon, Roma), historical patterns by day-of-week and hour, route comparisons, anomaly alerts when a port spikes 1.5x its baseline (usually wildfire, storm, closure, political event).

Two distinct surfaces with different audiences:
- **Cruzar Co-Pilot (consumer)** — iOS + web, $2.99/mo, for individual commuters/families/solo drivers
- **Cruzar Insights (B2B)** — web tools, $99/$299/$999/mo tiers, for RGV freight brokers + dispatchers + small fleets

## Audience

### Co-Pilot (consumer)
- **ICP:** RGV residents who cross 1-3x/week (work, family, school in the other country)
- **Geography:** McAllen, Edinburg, Mission, Pharr, Brownsville, Harlingen on the US side; Reynosa, Matamoros, Río Bravo on the MX side
- **Language:** Spanish-first or fully bilingual. Bilingual EN/ES is non-negotiable on every surface.
- **Use case:** "I have to cross at 6am Tuesday — when's the cleanest window?"
- **Status:** 62 founding members signed, 938 founder slots remaining

### Insights (B2B)
- **ICP:** RGV freight brokers + dispatchers + small fleets (~200 named businesses across the Valley)
- **Crossings they run:** Pharr, Laredo, Brownsville, Eagle Pass
- **Tools they use:** TMS systems like McLeod, Aljex, AscendTMS — NOT web dashboards. Mostly text + WhatsApp + phone.
- **Use case:** "Pharr is spiking. Should I reroute the 4pm load through Anzalduas?"
- **Status:** $0 paid customers — calibration moat being built first, then pitch

## Positioning

**One-liner:** "Receipts, not promises. The only RGV border-crossing app that publishes its prediction accuracy live."

**Differentiation:** Every prediction Cruzar makes gets logged in `calibration_log` and scored against actuals at the bridge. Customers see the live accuracy chart on the site. **Nobody else in the border-app space does this** — even CBP's own published wait times don't get audited. That's the marketing wedge: trust through transparency, not "AI-powered" claims.

**Voice:**
- **Honest, not promotional.** No "AI-powered" / "10x" / "game-changer" / "revolutionary."
- **Substrate-grounded.** Every claim shows its source (CBP API, NASA EONET, DOS travel advisories, DOF MX gov bulletins).
- **Bilingual EN/ES throughout.** Spanish copy must read as native MX-LATAM Spanish, not translated English.
- **AI is invisible to buyer.** Customer surface never mentions "Claude," "Anthropic," or model names. AI is infrastructure.

## Why-now

- iOS submission live (build 1.0(21) in App Store review). First mobile path for the consumer surface.
- 40hr workweek + STPS enforcement push in MX is increasing border crossings for compliance work — RGV is the major US-MX freight gateway for that flow.
- 43,000+ STPS inspections scheduled 2025-2026 means more truck activity at southbound crossings.
- Cruzar Insights B2B is the play — RGV brokers face daily wait-time risk that costs $200-2000 per missed appointment in detention fees.

## Distribution

**What works (per `~/brain/wiki/concepts/Distribution-channels-cross-portfolio.md`):**
- **Door-to-door at named McAllen broker offices** (~20-50 in McAllen alone) — highest leverage for B2B
- **WhatsApp commuter groups via warm intro** (cold doesn't work) — for consumer
- **Spanish-language radio relationships** (~5 stations in McAllen/Brownsville)
- **Local Facebook groups** — "RGV Crosses Daily," "Pharr Bridge Community"
- **Referral chains** — every founding member knows 5-10 people who'd use it

**What's dead (skip):**
- X/Twitter broadcast — wrong audience
- Reddit r/CrossBorder type subs — too small + scattered
- Generic Facebook ads to broad RGV demographic — money pit until warm proof

## Pricing
- Co-Pilot: $2.99/mo via RevenueCat (iOS) / Stripe (web)
- Insights Starter: $99/mo
- Insights Pro: $299/mo
- Insights Enterprise: $999/mo

## Constraints
- Solo founder, $30/mo Anthropic budget across portfolio
- All marketing must be async (no English/Spanish phone calls preferred)
- Supabase Pro tier ($35/mo across Cruzar + Laboral)
- iOS + web; no Android (Play Store closed-test gate shelved)
- LFPDPPP-compliant data handling (MX privacy law)

## Active competitors
- **CBP wait times official site** — free baseline data, no predictions, no anomaly detection. Cruzar overlays + extends.
- **Border Wait Time apps (various)** — show CBP data, no calibration, no Spanish, no broker-specific tools
- No direct B2B Insights competitor identified yet. Closest analogs: GeoTrade (predictive markets, different industry)

## Key memory references
- `~/brain/projects/Cruzar.md` — vault state
- `~/brain/wiki/concepts/Calibration-layer-cross-portfolio.md` — moat thesis
- `~/brain/wiki/concepts/Distribution-channels-cross-portfolio.md` — channel playbook
- `~/brain/wiki/concepts/Symbolic-Systems-for-Camp-B.md` — portfolio identity
- `claude-memory/project_calibration_cross_portfolio_thesis_20260430.md`
- `claude-memory/project_cruzar_b2b_stress_reliever_shipped_20260502.md` — latest B2B rebuild
