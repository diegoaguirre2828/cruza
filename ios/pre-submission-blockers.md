# Cruzar — iOS pre-submission blockers

Single source of truth for every item that must land before submitting
`Cruzar v1.0.0` to App Store Connect. Mirror of the Apple rejection
surface — if a row here is not ✅, do not submit.

Audit anchor: **2026-04-23** (this-session rebuild after `$99 Apple
Developer enrolment cleared). Last state check at the bottom.

---

## Legend
- ✅ Done in repo (code + asset shipped)
- 🛠️ Done in repo, needs Diego action (App Store Connect / Apple
  Developer / Supabase dashboard / GitHub Secrets)
- ❌ Not started
- ⚠️ Partial — works but not yet review-safe

---

## 1. Apple hard-reject surfaces

| # | Guideline | Status | What it is | Where it lives |
|---|-----------|--------|------------|----------------|
| 1 | 2.1 Metadata | ✅ | App name / subtitle / description / keywords / category / age | `ios/store-listing.md` |
| 2 | 4.2 Minimum functionality | ⚠️ | Capacitor webview loading `cruzar.app`. Mitigated by push + geolocation + IAP + native Apple Sign-In + bundled fallback shell. See §3 for why this is acceptable. | `capacitor.config.ts`, `public/cap-ios-shell/` |
| 3 | 4.8 Sign in with Apple | ✅ | Required because Google OAuth is present. Implemented. | `components/AppleButton.tsx`, `lib/nativeAppleAuth.ts` |
| 4 | 3.1.1 In-app purchase | ✅ | `Pro $2.99/mo` routed through StoreKit (via RevenueCat Capacitor SDK). Business tier hidden on iOS (B2B, sold off-platform). | `components/IOSSubscribeButton.tsx`, `app/pricing/page.tsx` |
| 5 | 5.1.1 Privacy policy | ✅ | Hosted at `cruzar.app/privacy`, linked in App Store Connect + settings screen | n/a |
| 6 | 5.1.2 Data collected | ✅ | Privacy manifest fully filled | `ios/App/App/PrivacyInfo.xcprivacy` |
| 7 | 5.1.1(iv) ATT | ✅ | `NSUserTrackingUsageDescription` not set because app does NOT track across other apps/websites. AdSense not yet live on iOS. | `ios/App/App/Info.plist` |
| 8 | Age rating 12+ | ✅ | Triggered by user-generated text (community reports). Not 4+. | App Store Connect questionnaire |
| 9 | 3.2.2(i) | ✅ | No cryptocurrency / gambling / unregulated content | n/a |

## 2. Technical submission requirements

| # | Item | Status | Notes |
|---|------|--------|-------|
| 10 | Bundle ID registered | 🛠️ | `app.cruzar.ios` — Diego registers on developer.apple.com |
| 11 | App Store Connect app record | 🛠️ | Diego creates record, pastes `store-listing.md` copy |
| 12 | Signing certs + provisioning profile | 🛠️ | Generated via Xcode on first archive OR via GHA workflow using App Store Connect API key |
| 13 | APNs push cert | 🛠️ | Diego creates Apple Push Notification key in developer.apple.com → Keys, uploads to Supabase |
| 14 | App Store Connect API key | 🛠️ | Diego generates in App Store Connect → Users & Access → Keys, downloads `.p8`, sets as GitHub Secret for CI |
| 15 | Sign in with Apple Service ID + Key | 🛠️ | Diego creates in developer.apple.com, enables capability on bundle ID, sets Supabase Apple provider |
| 16 | RevenueCat project + iOS API key | 🛠️ | Diego creates RevenueCat project, links App Store Connect, configures `Cruzar Pro Monthly $2.99` offering |
| 17 | AppIcon full set (1024 marketing + device sizes) | ✅ | Generated from 1024 master via `scripts/generate-app-icons.mjs` |
| 18 | Launch screen / splash | ✅ | `Splash.imageset` generated for iPhone + iPad sizes |
| 19 | Screenshots 6.7" + 6.5" (ES + EN) | ✅ | Generated via `scripts/generate-app-store-screenshots.mjs` (Playwright). 6 frames per locale. |
| 20 | Privacy manifest | ✅ | `PrivacyInfo.xcprivacy` complete — 11 collected data types, 4 API access reasons |
| 21 | Bundled webDir fallback | ✅ | `public/cap-ios-shell/` — minimal live-wait-times screen so binary has real content even if remote URL blocked |
| 22 | Info.plist URL schemes (SIWA + OAuth callback) | ✅ | `CFBundleURLTypes` includes `app.cruzar.ios` scheme |
| 23 | GitHub Actions macOS workflow (archive + TestFlight) | ✅ | `.github/workflows/ios-release.yml` |

## 3. Why `server.url = cruzar.app` does not fail 4.2

Apple's 4.2 pattern-rejects apps that are "just a repackaged website."
Cruzar ships with all of the following native integrations, any two
of which are usually enough to clear 4.2:

- Native push notifications (APNs, not Web Push) — plugin:
  `@capacitor/push-notifications`
- Native geolocation with background permission for waiting-mode
  geofence — plugin: `@capacitor/geolocation`
- Native Sign in with Apple (full native flow, not web-OAuth redirect)
- Native StoreKit IAP via RevenueCat
- Native storage / preferences — plugin: `@capacitor/preferences`
- Status bar + splash screen native styling
- Bundled fallback UI at `public/cap-ios-shell/` so the binary still
  renders live content if the remote URL is unreachable

If reviewer flags 4.2 anyway, remediation path is in §5.

## 4. Diego's external actions (in order)

These cannot be done from the Windows dev machine. Grouped by
dashboard.

### A. developer.apple.com

1. **App ID / Bundle ID** — Identifiers → + → App IDs → Bundle ID
   `app.cruzar.ios`. Capabilities to check: Sign in with Apple,
   Push Notifications, Associated Domains (for future Universal
   Links).
2. **APNs Auth Key** — Keys → + → name `Cruzar APNs`, enable APNs,
   download `.p8` + record Key ID + Team ID.
3. **Sign in with Apple Key** — Keys → + → name
   `Cruzar SIWA`, enable Sign in with Apple, configure primary app ID
   = `app.cruzar.ios`, download `.p8`.
4. **Services ID for SIWA web flow (if ever needed for web parity)** —
   Identifiers → + → Services IDs → `app.cruzar.ios.web`, enable Sign
   in with Apple, set domain + return URL to
   `<supabase-project>.supabase.co/auth/v1/callback`.

### B. appstoreconnect.apple.com

1. **Create app record** — My Apps → + → New App. Paste fields from
   `ios/store-listing.md`.
2. **Upload artwork + screenshots** — use files generated by
   `scripts/generate-app-store-screenshots.mjs` + the 1024 marketing
   icon at `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`.
3. **Configure IAP product** — Features → In-App Purchases → + →
   Auto-Renewable Subscription. Product ID
   `app.cruzar.ios.pro.monthly`. Price $2.99/mo. 7-day free trial.
4. **App Store Connect API key** — Users & Access → Keys → +. Role:
   App Manager. Download `.p8`, record Issuer ID + Key ID. Base64
   encode the `.p8` for GitHub Secret.

### C. revenuecat.com

1. Sign up free, create project `Cruzar`.
2. Link App Store Connect (paste API key from B.4).
3. Create entitlement `pro`. Create offering `default` with package
   `monthly` → product `app.cruzar.ios.pro.monthly`.
4. Record public SDK key → iOS (starts with `appl_`) → save as
   `NEXT_PUBLIC_REVENUECAT_IOS_KEY` in Vercel env.

### D. supabase.com

1. Authentication → Providers → Apple → Enable. Paste Services ID,
   Team ID, Key ID, `.p8` contents.
2. Authentication → URL Configuration → Redirect URLs: add
   `app.cruzar.ios://auth-callback` (for native app deep link).

### E. github.com/diegoaguirre2828/cruzar → Settings → Secrets

Required for `.github/workflows/ios-release.yml` to run:

- `ASC_API_KEY_ID` — from B.4
- `ASC_API_ISSUER_ID` — from B.4
- `ASC_API_KEY_P8_BASE64` — base64 of the `.p8` file
- `APPLE_TEAM_ID` — 10-char Team ID from developer.apple.com
- `MATCH_PASSWORD` — make up a strong passphrase used by fastlane
  match for cert encryption (only needed if we migrate to match
  later; the current workflow uses App Store Connect API key auth
  and does not need this yet — leave blank)

## 5. Remediation if reviewer rejects

### 4.2 (webview wrapper) rejection
Fall back to routing the iOS binary at the bundled shell only. Flip
`capacitor.config.ts` → remove `server.url` → rebuild the bundled
shell to include the full home/port-detail/pricing flow as a client
SPA calling `cruzar.app` APIs over HTTPS. This is ~2-3 days of work
but kills 4.2 entirely because the binary becomes the app.

### 3.1.1 (external payment) rejection
Already mitigated by RevenueCat IAP. If reviewer still complains,
the "Available at cruzar.app" fallback on Business tier may be the
trigger — remove the pointer entirely and require users to log in
on web for Business.

### 4.8 (Sign in with Apple equivalence) rejection
Already mitigated. Native SIWA ships. If reviewer says button must
be visually equal to Google — swap the order so Apple is above
Google on iOS.

## 6. Last state check

Reconcile this table every session touching the iOS build. Treat as
the pre-submission sign-off — nothing under "Not started" or
"Partial" may ship.

| Section | Not started | Partial | Diego-action | Ready |
|---------|-------------|---------|--------------|-------|
| 1. Apple hard-reject | 0 | 1 (4.2, mitigated) | 0 | 8 |
| 2. Technical submission | 0 | 0 | 7 | 7 |
| **Total** | **0** | **1** | **7** | **15** |

Last updated: 2026-04-23 by Claude Code session after $99 enrolment.
