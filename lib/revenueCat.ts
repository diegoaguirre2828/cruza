// RevenueCat wrapper for the iOS Pro subscription (StoreKit IAP).
// Apple guideline 3.1.1 blocks Stripe for digital subs inside iOS apps,
// so Pro purchases made from the Capacitor-iOS build route through
// RevenueCat → StoreKit. Entitlement `pro` maps to product
// `app.cruzar.ios.pro.monthly`.

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

export async function purchaseProMonthly(): Promise<{ purchased: boolean; error?: string }> {
  if (!isIOSAppClient()) return { purchased: false, error: 'IAP only available in iOS app' }
  try {
    const offerings = await Purchases.getOfferings()
    const pkg = offerings.current?.monthly
    if (!pkg) return { purchased: false, error: 'No monthly package configured in RevenueCat' }
    const result = await Purchases.purchasePackage({ aPackage: pkg })
    const entitled = !!result.customerInfo.entitlements.active['pro']
    return { purchased: entitled }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('cancel')) return { purchased: false }
    return { purchased: false, error: msg }
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
