'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export function ExchangeRateWidget() {
  const { lang } = useLang()
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/exchange')
      .then(r => r.json())
      .then(d => { setRate(d.rate); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null

  return (
    <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 mb-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-lg">💱</span>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {lang === 'es' ? 'Tipo de cambio hoy' : 'Exchange rate today'}
          </p>
          {rate ? (
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              $1 USD = <span className="text-green-600 dark:text-green-400">${rate.toFixed(2)} MXN</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {lang === 'es' ? 'No disponible' : 'Unavailable'}
            </p>
          )}
        </div>
      </div>
      <Link
        href="/services"
        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 ml-3"
      >
        {lang === 'es' ? 'Servicios en MX →' : 'Services in MX →'}
      </Link>
    </div>
  )
}
