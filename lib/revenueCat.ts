// RevenueCat wrapper for the iOS Pro subscription (StoreKit IAP).
// Apple guideline 3.1.1 blocks Stripe for digital subs inside iOS apps,
// so Pro purchases made from the Capacitor-iOS build route through
// RevenueCat → StoreKit. Entitlement `pro` maps to product
// `app.cruzar.ios.pro.monthly.v2` (v1 was deleted 2026-05-05 — Apple permanently retires deleted product IDs).

import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { isIOSAppClient } from './platform'

let configurePromise: Promise<void> | null = null

export async function initRevenueCat(userId?: string): Promise<void> {
  if (!isIOSAppClient()) return
  if (configurePromise) return configurePromise

  configurePromise = (async () => {
    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
    if (!apiKey) {
      console.warn('[RevenueCat] NEXT_PUBLIC_REVENUECAT_IOS_KEY not set — Pro IAP disabled')
      return
    }
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN })
    await Purchases.configure({ apiKey, appUserID: userId })
  })()

  return configurePromise
}

// User-facing error string — deliberately vendor-agnostic. Apple Review
// flagged "No monthly package configured in RevenueCat" on build 1.0(21)
// as a 2.1(a) completeness bug because (a) it surfaces the third-party
// vendor name and (b) reads like a developer log, not a user message.
const SUBS_TEMP_UNAVAILABLE_EN = 'Subscriptions are temporarily unavailable. Please try again in a moment.'
const SUBS_TEMP_UNAVAILABLE_ES = 'Las suscripciones no están disponibles temporalmente. Inténtalo de nuevo en un momento.'

function localizedTempUnavailable() {
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es')) {
    return SUBS_TEMP_UNAVAILABLE_ES
  }
  return SUBS_TEMP_UNAVAILABLE_EN
}

// Best-effort server log so we can debug review-time failures without
// adding Sentry overhead. Fire-and-forget; never blocks the user flow.
function logIapFailure(reason: string, detail?: string) {
  if (typeof fetch === 'undefined') return
  try {
    fetch('/api/log/ios-iap-failure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason, detail, ts: new Date().toISOString() }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Swallow — telemetry must never break the purchase flow.
  }
}

export async function purchaseProMonthly(): Promise<{ purchased: boolean; error?: string }> {
  if (!isIOSAppClient()) return { purchased: false, error: 'IAP only available in iOS app' }
  try {
    const offerings = await Purchases.getOfferings()
    const pkg = offerings.current?.monthly
    if (!pkg) {
      logIapFailure('no_monthly_package', `current=${offerings.current?.identifier ?? 'null'}`)
      return { purchased: false, error: localizedTempUnavailable() }
    }
    const result = await Purchases.purchasePackage({ aPackage: pkg })
    const entitled = !!result.customerInfo.entitlements.active['pro']
    return { purchased: entitled }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('cancel')) return { purchased: false }
    logIapFailure('purchase_threw', msg)
    return { purchased: false, error: localizedTempUnavailable() }
  }
}

// Preflight offerings check. Returns true ONLY if RevenueCat returns a
// healthy offerings object with a `monthly` package — i.e. the IAP is
// actually purchasable right now. Used by IOSSubscribeButton to hide
// itself when offerings are empty so Apple Review can't trigger the
// "products could not be fetched from App Store Connect" error that
// got us rejected on build 1.0(21) review #2 (2026-05-03 10:54 UTC).
//
// Empty offerings = Diego still owes one of these App Store Connect
// dashboard items:
//   1. Paid Apps Agreement signed (Agreements, Tax, Banking)
//   2. Banking + Tax filled in
// 3. IAP `app.cruzar.ios.pro.monthly.v2` status = "Ready to Submit"
//   4. IAP attached to the binary submission
//   5. RevenueCat offering linked to product ID
// Once Diego completes those, this returns true and the button auto-shows.
export async function isProAvailableForPurchase(): Promise<boolean> {
  if (!isIOSAppClient()) return false
  try {
    const offerings = await Purchases.getOfferings()
    return !!offerings.current?.monthly
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logIapFailure('preflight_threw', msg)
    return false
  }
}

export async function isProActiveOnDevice(): Promise<boolean> {
  if (!isIOSAppClient()) return false
  try {
    const info = await Purchases.getCustomerInfo()
    return !!info.customerInfo.entitlements.active['pro']
  } catch {
    return false
  }
}

export async function restorePurchases(): Promise<{ restored: boolean; error?: string }> {
  if (!isIOSAppClient()) return { restored: false, error: 'Restore only available in iOS app' }
  try {
    const result = await Purchases.restorePurchases()
    const entitled = !!result.customerInfo.entitlements.active['pro']
    return { restored: entitled }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { restored: false, error: msg }
  }
}
