# Surround thesis — Cruzar (consumer / daily-crosser side)

> Sister doc: the trade-clearance B2B side has its own 12-wall surround executed 2026-05-04 (Tickets substrate, modules customs / pedimento / regulatory / paperwork / drivers / driver-pass / refunds / drawback / MDR / CBAM / UFLPA / transload). This doc is for the OTHER side of the same app — the commuter, family, RGV resident who crosses for work / school / errands / a brisket run.

## 1. Kingdom

A user knows when to leave, knows the bridge is moving, doesn't worry about the trip while crossing, and gets a clean record of what just happened — without surprises (sudden waits, surprise inspections, casa-de-cambio rip-offs, missed family ETA).

## 2. Walls (user-value-domains, not infra-plumbing)

| # | Wall | What it actually is |
|---|---|---|
| 1 | **Live wait-time delivery** | The "is it moving right now" signal that drives every decision |
| 2 | **Bridge camera transparency** | Eyes on the lane that CBP doesn't publish openly |
| 3 | **Officer-staffing leading-indicator** | Lane-count drops 15-30 min ahead of wait spikes |
| 4 | **Real exchange-rate visibility** | Casa-de-cambio asymmetry between official and street rate |
| 5 | **Pre-trip preparation** | SENTRI status, FMM, vehicle docs, route, weather, closures |
| 6 | **Live-trip safety + family ETA** | Co-pilot mode, geofenced "I crossed" auto-text, /sos for emergencies |
| 7 | **Post-trip closure** | Submit report → alert auto-off → trip recorded |
| 8 | **Auto cross-detection** | Geofence + checkpoint detection without tapping |
| 9 | **Local commerce at bridges** | Insurance, food, money exchange, mechanics — bridge-context, not Google-Maps-context |
| 10 | **Border-closure / incident detection** | News + camera anomaly + community signal merged |
| 11 | **Weather + natural-event context** | NASA EONET wildfires/floods/dust within 100 km of the bridge |
| 12 | **Multi-device push delivery** | iPhone + Android + web — Facebook groups can't push |

## 3. Wall × incumbent

| Wall | Who attacks today |
|---|---|
| 1 Live wait | **Facebook border crossing groups** — manual posts, scrolling, no structure (this is the real fight) |
| 2 Cameras | TX DOT public HLS feeds + nothing — no aggregator |
| 3 Officer staffing | Nobody. CBP doesn't publish; we derive |
| 4 Exchange rate | Manual asking, individual casas posting on FB |
| 5 Pre-trip prep | CBP / INM portals (terrible UX) + SENTRI website + insurance agencies |
| 6 Trip safety | Apple Find My, Life360, manual texts |
| 7 Post-trip closure | Nothing — alerts spam users after they cross |
| 8 Cross-detection | Nothing — users self-report or don't |
| 9 Local commerce | Google Maps (no bridge context), Facebook (cluttered) |
| 10 Closures | Local news, Facebook posts, word of mouth |
| 11 Weather | Apple Weather / AccuWeather (not bridge-aware) |
| 12 Push | Facebook Messenger (broken for this), SMS individual texts |

## 4. Wall × native edge

| Wall | Native edge | Verdict |
|---|---|---|
| 1 Live wait | Push delivery + structured data + community reports tied to specific bridge / lane / time | **Strong — keep attacking** |
| 2 Cameras | Aggregator + AI-readable frames + ffmpeg pipeline (`v43`, `v55c` shipped) | **Strong** |
| 3 Officer staffing | Derived from camera lane count → leading indicator (Pro tier, `v55d → v56`) | **Unique** |
| 4 Exchange rate | Crowdsourced **real** casa-de-cambio rates from RGV users, not API mid-market | **Strong, RGV-native** |
| 5 Pre-trip prep | RGV-specific port knowledge + bilingual + we already know the user's bridge | **Medium — needs build-out** |
| 6 Trip safety | Co-pilot + family ETA + auto-text are shipped (v68); nobody bundles for border context | **Strong, shipped not surfaced** |
| 7 Post-trip closure | Diego flagged 2026-05-04: alerts keep firing after cross. Native edge = we have the report system + geofence + alert table — incumbent doesn't | **Highest leverage gap** |
| 8 Cross-detection | Already shipped (`v48 + v49`) opt-in geofence; we have the table | **Shipped, untapped** |
| 9 Local commerce | RGV biz directory `/negocios` shipped with claim flow; bridge-context surface | **Strong** |
| 10 Closures | Camera anomaly + EONET + community reports — three signals nobody else combines | **Buildable** |
| 11 Weather | EONET 100 km bridge-wired (`v0.5.4`) — already shipped | **Shipped, untapped on consumer side** |
| 12 Push | VAPID-mismatch detection shipped, end-to-end verified 2026-05-03 night | **Solid** |

**Walls dropped (no native edge or actively blocked):**
- Native iOS SIWA — Apple Dev Console capability busted; deferred to Apple Dev Support call
- WhatsApp Business — Meta account restriction on Diego's FB; can't operate
- Play Store — 12-tester / 14-day rule infeasible solo (TIER-0 shelved per `project_cruzar_play_console_closed_test_gate_20260423`)
- Insurance / FMM / SENTRI workflow ownership — would require licensure; DeWalt-frame says no. We point users at portals, we don't become the portal

## 5. Substrate

**Cruzar Crossing** — a signed crossing record per trip.

Same architectural pattern as the B2B `lib/ticket/` (Ed25519 signed JSON, public viewer, `modules_present` array, bilingual PDF render). Difference: the B2B Ticket binds trade-clearance modules; Cruzar Crossing binds **trip-side modules** for one user × one bridge × one direction × one time window.

Block shape (each module composes one):

```
CruzarCrossingV1 = {
  id: uuid
  user_id: uuid
  port_id: text
  direction: 'us_to_mx' | 'mx_to_us'
  started_at: timestamptz
  ended_at: timestamptz | null
  signature: base64 (Ed25519, same key as Ticket)
  modules_present: ('prep' | 'live' | 'detection' | 'report' | 'closure' | 'safety' | 'context')[]
  prep?: PrepBlock           // SENTRI/FMM/route/weather check at start
  live?: LiveBlock           // wait readings + camera frames during cross
  detection?: DetectionBlock // auto-cross timestamp + geofence path
  report?: ReportBlock       // user's submitted report (if any)
  closure?: ClosureBlock     // alert auto-off confirmation
  safety?: SafetyBlock       // co-pilot transcript, family ETA fired
  context?: ContextBlock     // EONET nearby events, closures detected
}
```

Public viewer at `/crossing/[id]`. Bilingual PDF render reusing `lib/ticket/pdf.ts`. Storage: new table `crossings` (migration v85+).

**Why this is load-bearing:** without it, the consumer side is currently a list of disconnected point-tools (12+ shipped surfaces, no shared record). Once Crossings exist, every existing surface composes one block, and every new wall follows the same shape.

## 6. Next stub

**Cruzar Crossing v0 + Cross-Closure module (alert auto-off)**

Picked because:
- **Audience overlap = max** — every user with an active alert sees this. That's the largest installed feature surface (alerts are the #1 reason users stay).
- **Native edge = clear** — we have geofence detection, the alert table, the report system, push delivery. Nobody else has these tied together.
- **Ship-able in one focused session** — the substrate seed (Crossing record + signing + viewer) plus one composing module (cross-detect → closure block → alert snooze)
- **Diego flagged it 2026-05-04 night** — explicit user pull, not a guess
- **Solves the "alerts feel spammy" complaint** that's currently eating retention

Not the most architecturally ambitious starting module. Picked because it's the biggest *user-felt* improvement that ALSO seeds the substrate. Same logic as the trade-clearance side picking customs first — high audience-overlap × ship-able.

### Scope of this stub

1. Migration v85: `crossings` table + RLS + Ed25519-signed (reuse Ticket's signing key)
2. `lib/crossing/` chassis (types / generate.ts / json-signer (reuse) / pdf (reuse skeleton))
3. `app/api/crossings/<id>/route.ts` GET (signed bundle) + POST (compose)
4. `app/crossing/[id]/page.tsx` public viewer (single language per user)
5. **Closure module wiring**:
   - `app/api/copilot/cross-detected/route.ts` extended → write detection block + closure block + flip `alert_preferences.snoozed_until` to next 4am local
   - Send-alerts cron skips alerts with `snoozed_until > now()`
   - Alert push gets a "Ya crucé — apagar" / "Already crossed — turn off" action button (single language)
   - Service worker action handler → POST `/api/alerts/[id]/snooze` → write closure block manually
6. Audit runner `scripts/run-crossings-audit.mjs` with fixtures
7. Recon memo at `~/.claude/projects/C--Users-dnawa/memory/project_cruzar_crossings_substrate_audit_<date>.md`

Skipped this round: prep/live/safety/context blocks. They get added in subsequent stubs once the substrate is proven. **Closure first** because it's where the user feels the spam.

## 7. Canonical module shape (consumer side)

Every new wall's stub follows this exact layout. No re-architecting per module.

```
lib/chassis/<module>/types.ts              # block schema + composer input/output
lib/chassis/<module>/composer.ts           # pure: input → block + verifier results
lib/chassis/<module>/<verifier>.ts         # one verifier per concern
lib/chassis/<module>/__tests__/            # via run-<module>-audit.mjs

data/<module>/test-fixtures/*.json         # known-answer fixtures (8+ per verifier)

app/api/<module>/scan/route.ts             # FREE public scanner (no auth, viral funnel)
app/api/<module>/[id]/route.ts             # signed bundle GET + module-specific POSTs
app/api/cron/<module>-tracker/route.ts     # if module needs scheduled work

app/<module>/page.tsx                      # consumer-facing UI (workspace card or full page)
app/<module>/<Module>Client.tsx            # client island

lib/copy/<module>-en.ts                    # single-language copy
lib/copy/<module>-es.ts                    # single-language copy
                                           # NEVER side-by-side — feedback locked 2026-05-03

lib/crossing/types.ts                      # extend CruzarCrossingV1 with <Module>Block
lib/crossing/generate.ts                   # accept optional <module>Input

scripts/verify-<module>-<verifier>.mjs     # one verify-* per fixture group
scripts/run-<module>-audit.mjs             # composes verify-* into one gate

supabase/migrations/v<n>-<module>.sql      # new tables + RLS
```

After audit gate passes, recon log goes to `~/.claude/projects/C--Users-dnawa/memory/project_cruzar_<module>_audit_<YYYYMMDD>.md` with: pass count, fixture coverage, blocks added to Crossing, anything skipped + why.

**DeWalt frame** (per Diego's lock): every consumer module is a tool the user holds. We don't take on regulatory liability (we don't issue SENTRI cards, we don't sell insurance, we don't file FMMs). We compose, we sign, we surface, we hand off.

**Bilingual** is table stakes — render single-language per user via the new `profiles.language` column (v84). Never pitch EN/ES as a feature.

---

## Named pick — next stub

**Cruzar Crossing v0 + Cross-Closure module.** Greenlight to build, or push back on scope.
