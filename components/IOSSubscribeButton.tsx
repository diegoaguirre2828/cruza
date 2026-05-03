'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { purchaseProMonthly, restorePurchases, isProAvailableForPurchase } from '@/lib/revenueCat'

export function IOSSubscribeButton({
  className = '',
  ctaOverride,
}: { className?: string; ctaOverride?: string }) {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Preflight gate. RevenueCat's getOfferings() can return empty when
  // ASC config isn't complete (Paid Apps Agreement unsigned, IAP not
  // Ready to Submit, etc). Hiding the button entirely until offerings
  // are healthy prevents Apple Review from triggering the "products
  // could not be fetched" error that rejected build 1.0(21) on
  // 2026-05-03 (telemetry: ios_iap_failure reason=purchase_threw).
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    isProAvailableForPurchase().then(ok => {
      if (!cancelled) setAvailable(ok)
    })
    return () => { cancelled = true }
  }, [])

  // While preflight is in flight: render nothing (avoids flash).
  if (available === null) return null

  // If offerings empty, show a soft disabled "Coming soon" state instead
  // of the live purchase button. Reviewer sees a non-interactive marker
  // (no IAP error possible) and the Pro card stays visually complete.
  // Auto-flips back to the real button when Diego's ASC dashboard work
  // makes offerings non-empty on next mount.
  if (available === false) {
    return (
      <div className={className}>
        <div className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-center">
          {es ? 'Próximamente en iOS' : 'Coming soon on iOS'}
        </div>
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500 text-center leading-snug">
          {es
            ? 'Mientras tanto, suscríbete desde la web en cruzar.app desde tu computadora.'
            : 'Meanwhile, subscribe from the web at cruzar.app on your computer.'}
        </p>
      </div>
    )
  }

  const cta = ctaOverride ?? (es ? 'Empezar prueba gratis 7 días' : 'Start 7-Day Free Trial')

  async function handlePurchase() {
    if (!user) {
      window.location.href = `/signup?next=${encodeURIComponent('/pricing')}`
      return
    }
    setLoading(true)
    setError(null)
    const result = await purchaseProMonthly()
    setLoading(false)
    if (result.purchased) {
      window.location.href = '/dashboard?upgraded=pro'
    } else if (result.error) {
      setError(result.error)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setError(null)
    const result = await restorePurchases()
    setRestoring(false)
    if (result.restored) {
      window.location.href = '/dashboard?restored=pro'
    } else if (result.error) {
      setError(result.error)
    } else {
      setError(es ? 'No encontramos una suscripción activa.' : 'No active subscription found.')
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handlePurchase}
        disabled={loading}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {loading ? (es ? 'Procesando…' : 'Processing…') : cta}
      </button>
      <button
        type="button"
        onClick={handleRestore}
        disabled={restoring}
        className="w-full mt-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
      >
        {restoring ? (es ? 'Restaurando…' : 'Restoring…') : (es ? 'Restaurar compra' : 'Restore purchase')}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
