'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { purchaseProMonthly, restorePurchases } from '@/lib/revenueCat'

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
