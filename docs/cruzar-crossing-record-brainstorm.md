# Cruzar Crossing Record — full brainstorm + roadmap

> Replaces the surround-thesis doc that was too consulting-deck. Plain English. Diego's directive 2026-05-04 night: "make this feel like an app, not just FB groups in one place" + "track data to help prediction models" + "take this whole thing another step further."

## The actual idea in 60 seconds

Right now Cruzar has 12+ shipped features but they don't share state. Alert system doesn't know geofence detected you crossed. Reports don't auto-close alerts. Co-pilot trip data doesn't feed back into wait predictions. Camera frames during your trip aren't tied to your cross-detection. Your wallet/SENTRI status from one trip isn't remembered for the next.

Every feature operates in a silo. That's why the app feels like a "FB group replacement" — a list of useful tools, not a connected system.

The fix: **one row in the database per crossing**, signed and immutable, that every feature reads from + writes to. Geofence writes the cross-time. Alert writes its fire+close. Camera writes the frame at the moment you crossed. Co-pilot writes the route. Reports link to it. Predictions train on it.

When everything writes to one record, three things happen:
1. Features start talking to each other (no more alert spam after cross)
2. Predictions get a feedback loop they don't have today (model said 40 min, you actually crossed in 38 — write that pair, retrain)
3. The user gets a real "history" — every past crossing is a viewable record they can show their family, employer, or insurance company

## The data flywheel — why this is load-bearing for predictions

Cruzar's prediction stack today (per CLAUDE.md):
- **v0.5.2 RandomForest** serving 52 ports via `cruzar-insights-api.vercel.app`
- Trains on `wait_time_readings` (CBP API every 15 min) + `crossing_reports` (community-submitted)
- Calibration log on the B2B side: predicted vs actual

What's missing: **per-user, per-trip ground truth**.

CBP says "average wait at Hidalgo right now: 38 min." Reality varies by:
- Lane (vehicle / SENTRI / pedestrian / commercial)
- Time of day (rush / off-peak)
- Day type (weekday / weekend / holiday / payday)
- Vehicle type (sedan / pickup / commercial)
- Document status (SENTRI / regular / first-time)
- Fluency / interaction with officer
- Random secondary-inspection lottery
- Bridge incident at that exact moment (officer break, system glitch)

The aggregate CBP signal averages all of this away. A user-specific crossing record captures the actual delta — *this user with SENTRI in a sedan at 7:14am Tuesday took 9 minutes through Hidalgo while CBP's signal said 38*.

Enough of those records, the model can:
- Learn per-cohort distributions (SENTRI users at Hidalgo on weekday mornings ≈ N(11, 3) min)
- Learn per-user distributions (you specifically average 14% faster than the cohort)
- Learn cross-bridge switching (when a user abandoned Hidalgo at 7am because the prediction said spike → did the spike actually hit?)
- Auto-validate every alert (predicted drop to ≤30 min, did the user actually cross under 30?)
- Detect anomalies in real-time (10 users mid-cross taking 2x predicted = bridge incident, push closure alert)

This isn't a future feature. **The data we'd need is being thrown away today** because no shared record collects it. Every push of "you've crossed" disappears unless we wire it into a record.

## What the crossing record actually contains

```
CruzarCrossing {
  id: uuid                        // row id
  user_id: uuid
  port_id: text                   // e.g. '230501' (Hidalgo)
  direction: 'us_to_mx' | 'mx_to_us'
  started_at: timestamptz         // when prep block written, OR alert fired, OR user opened the bridge page — earliest signal
  ended_at: timestamptz | null    // null while in-progress
  status: 'planning' | 'en_route' | 'in_line' | 'crossing' | 'completed' | 'abandoned'
  modules_present: ['prep' | 'alert' | 'live' | 'detection' | 'report' | 'closure' | 'safety' | 'context' | 'commerce']
  signature: base64               // Ed25519, same key as B2B Cruzar Ticket
  blocks: jsonb                   // see below
  cohort_tags: text[]             // ['sentri','sedan','weekday-am','holy-week'] for ML grouping
}
```

Blocks (each module composes one):

| Block | Written by | Contains |
|---|---|---|
| `prep` | User opens bridge page / starts trip | Expected bridge, document status (SENTRI?), weather at bridge, route plan, predicted-wait at start |
| `alert` | send-alerts cron | Alert fired at T, threshold, predicted-drop value, channels (push/sms/email) |
| `live` | Bridge page during trip | CBP wait readings during the trip, camera frames captured, anomaly flags |
| `detection` | `/api/copilot/cross-detected` | Auto-cross timestamp, geofence path, confidence, lane (if known) |
| `report` | `/api/reports` POST | User's submitted report — actual minutes, condition, type |
| `closure` | Closure trigger | Alert turned off (auto / by-button / by-report), reason, snoozed_until |
| `safety` | Co-pilot mode | Family ETA fired, contact texted, /sos invoked if any |
| `context` | EONET + closures | Natural events near bridge during cross, news closures, officer-staffing anomaly |
| `commerce` | Negocios / exchange | Casa-de-cambio used, business visited, exchange rate snapshot |

**modules_present** array tells consumers (UI, ML, API) what fired. Same shape as B2B Ticket — reuse the architecture.

## What this enables — concrete features

Sorted by impact-per-effort (what we should ship first toward what's most ambitious):

### Tier 1 — Immediately visible to user (next 1-2 sessions)

1. **Auto-snooze on cross-detection** — geofence detects → closure block → alert flips to `snoozed_until = tomorrow 4am`. No more 1pm spam after morning crossing. *Diego's tonight ask.*

2. **"Ya crucé" push action button** — same outcome, manual path for users who didn't opt into geofence. Service worker handles the action POST.

3. **My Crossings tab** in `/dashboard` — last 10 trips, time taken, lane used. Personal trip history. Becomes retention hook ("look how many times Cruzar saved you waiting").

4. **Family ETA proof** — share `/crossing/[id]` link with family. Signed bilingual PDF. "Made it, here's the receipt." Replaces "I'm at the bridge, talking to officer, will text when through" texts that 90% of users send today.

### Tier 2 — Data flywheel kicks in (after 100+ records)

5. **Personal wait prediction** — "based on YOUR last 12 crossings at Hidalgo, you average 14 min on weekday mornings, 28 on Friday afternoons." Beats the bridge-aggregate prediction for THIS user.

6. **Cohort prediction uplift** — model retrains nightly with confirmed crossings as labeled training pairs (CBP-prediction-at-T → actual-cross-duration). Calibration improves on every active port.

7. **Alert-accuracy public scoreboard** — "Cruzar's wait-drop alerts hit ±5 min on 87% of crossings at Hidalgo in March." Press story. Trust signal. Driven by `closure` blocks linking back to predicted-drop in `alert` blocks.

8. **Anomaly real-time** — 8 users mid-cross taking 2× predicted → push alert to OTHER users at same bridge: "Right now, expect ~50 min vs predicted 28." Crowd-validated incident detection.

### Tier 3 — Emergent product (3-5 sessions out)

9. **Smart pre-departure** — when you tap a bridge page, system reads YOUR history + weather + holiday calendar + current CBP signal → suggests optimal departure window. SMS night before for next-day commuters.

10. **Reverse-crossing detection** — geofence both directions catches day-trippers vs commuters vs movers. Different cohorts, different products (commuter alerts vs day-trip casa+restaurant recs vs moving-day documents).

11. **Time-saved dashboard** — "By using Cruzar alerts in 2026, you saved 4h 23min vs random departure." Personal ROI. Powerful retention. Math = sum over crossings of (CBP-predicted-wait-at-departure-time − actual-cross-duration).

12. **Apple Wallet / Google Wallet pass** — "Today's Crossing" pass auto-updates with live wait. Tap → opens Cruzar to bridge page. Embedded in iOS Wallet UX. Same .pkpass infrastructure Borvo just shipped.

13. **Crossing-share to Insights B2B** — for fleet drivers, individual crossing record auto-reconciles back into fleet trip-log Ticket. Trucker writes consumer Crossing, dispatcher sees Cruzar Ticket update with `driver_crossings: [{...}]`. Bridges the consumer ↔ B2B sides through one substrate per side, linked.

### Tier 4 — Long-tail / ambitious

14. **Crossing certificate for employers/insurance** — verifiable bilingual PDF proving you crossed at X time. For workers crossing the bridge for jobs. For insurance claims (delayed for legitimate reason). Already have signing infra.

15. **Differential-privacy aggregate API** — partners (academics, customs research, urban planners) query bridge-level confirmed-crossing data without PII. Could be revenue stream OR PR.

16. **Calibration challenges** — community challenges Cruzar's predictions. User crosses, system asks "we said 40 min, you took 45 — confirm?" Award points for confirmation. Data-quality-as-game.

17. **Border season models** — Holy Week, Christmas, end-of-school each have crossing-record-detectable patterns. Per-user "season behavior" model. Predict your December surge.

18. **Crossing-graph topology** — which bridges users frequently combine. Marketing uses to expand product (north-McAllen residents Hidalgo→Anzalduas pattern → market a "best-time route between these two" feature).

19. **Public bridge health score** — aggregate from confirmed crossings, not just CBP API. "Hidalgo health: 83/100 (avg cross 14 min, anomaly rate 4%)." Public dashboard. Press story. Could feed insurance/logistics pricing.

20. **Insurance trigger** — crossing record stuck >30 min camera-locked at the cross point with no cross-detection finalized → auto-trigger safety net (emergency contact, SOS prep). Already have /sos page; this connects the dots.

## Build phases

### Phase 1 — Substrate seed (next session, 2-3 hours)

Goal: ship the table + signing + viewer + ONE composing module (closure / auto-snooze).

- Migration v85 — `crossings` table + RLS
- `lib/crossing/` chassis — types, generate, json-signer (reuse `lib/ticket/json-signer.ts`), pdf skeleton
- `app/api/crossings/` — POST (compose), GET `[id]` (signed bundle), GET (list mine)
- `app/crossing/[id]/page.tsx` — single-language viewer
- Migration v85b — `alert_preferences.snoozed_until timestamptz`
- `app/api/alerts/[id]/snooze/route.ts` — POST
- Service worker — handle "ya_crucé" push action
- send-alerts cron — skip alerts where `snoozed_until > now()`
- `/api/copilot/cross-detected` — extended to write detection+closure blocks + auto-snooze alert
- Push template — append "Ya crucé" / "Already crossed" action button (single-language per profile)
- Audit gate — `scripts/run-crossings-audit.mjs` with 10+ fixture cases
- Recon log

### Phase 2 — Backfill + first ML feedback (next session)

Goal: seed the database with historical signal so predictions can start using crossing records.

- Backfill from `auto_crossings` table (existing geofence detections) into `crossings.detection` blocks
- Backfill from `crossing_reports` linked by user_id + port_id + close-timestamp into `crossings.report` blocks
- Add `crossings` join to ML training pipeline at `cruzar-insights-ml`
- Public per-port calibration page extension — show actual-cross stats from confirmed crossings, not just CBP

### Phase 3 — User-visible UX (next session)

- `/dashboard` — "My Crossings" tab
- `/crossing/[id]` — share button (Web Share API + clipboard)
- Push notification → after delivery, automatic post-cross "rate this crossing" prompt (optional, retention)
- Personal-wait widget on `/port/[id]` — your average vs current

### Phase 4 — Data flywheel polish (multi-session)

- Per-user cohort tagging
- Nightly retrain on confirmed crossings
- Anomaly broadcaster from real-time crossing-record stream

### Phase 5 — Ambitious (when ready)

- Apple/Google Wallet pass
- Crossing-share to B2B Ticket
- Calibration challenges
- Bridge health score public
- Differential-privacy aggregate API

## Things I'm explicitly NOT proposing

- Mandatory geofence (privacy + battery; opt-in only as today)
- Public crossing records by default (private to user; share is opt-in)
- Replacing community reports (reports complement crossings, don't duplicate)
- Building a separate signing key (reuse `lib/ticket/json-signer.ts`)
- Selling individual crossing data (DeWalt frame; aggregates only)
- Becoming an insurance / FMM / SENTRI processor (parked per Aguirre TIER-0)

## Open questions for Diego

1. **Naming.** "Cruzar Crossing" is self-referential (cruzar means to cross). Could also be: Crossing Record, Trip Record, Cross Receipt, Trip Pass. Lock before building UI copy.

2. **Pre-trip block trigger.** Easiest is "user opens a port page" → start a Crossing in `planning` state. Aggressive is "we predict you're about to cross based on your morning pattern" → auto-create. Start with easiest.

3. **Privacy default.** Crossings private to user OR shareable by default? My take: private, share is explicit. Family ETA share is the most common case and that's a manual link generation.

4. **Backfill scope.** Backfill from `auto_crossings` is straightforward. Backfilling from reports is heuristic (have to match user_id × port_id × time-window). Worth it? My take: yes, it seeds the ML flywheel cheaply.

5. **Predictions API contract.** When `cruzar-insights-api` retrains with confirmed crossings, do we expose a new endpoint or augment the existing `/api/forecast`? Easiest is augment.

## My recommendation for tonight / next session

**Phase 1 only — substrate seed + closure module.** That's already 2-3 hours and ships the user-felt fix you want (no more alert spam). Phases 2-5 follow over the next week.

The bigger architectural moves (Wallet pass, Insights B2B linkage, ambitious data products) only make sense once the substrate exists. Phase 1 is the unlock; everything else compounds from it.

Greenlight Phase 1 and I'll start building.
