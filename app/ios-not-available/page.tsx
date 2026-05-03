// Bilingual fallback for iOS-app users navigating to a B2B-only route.
// proxy.ts rewrites /insights, /dispatch, /paperwork, /transload, /operator
// here when the request UA contains `CruzarIOS`. We're keeping the B2B
// surface available on the web at cruzar.app — this page tells iOS users
// where to go without exposing the Stripe checkout that lives on the
// real B2B routes (which would trigger Apple guideline 3.1.1).
//
// 2026-05-03 — sister-site split. Once Diego signs the Paid Apps
// Agreement + IAP is verified, we can re-enable selected B2B surfaces
// on iOS via StoreKit (or keep the web-only split permanently — the
// B2B audience uses laptops anyway).

import Link from 'next/link'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const TITLES: Record<string, { en: string; es: string }> = {
  insights: { en: 'Cruzar Insights — available on the web', es: 'Cruzar Insights — disponible en la web' },
  dispatch: { en: 'Dispatch console — available on the web', es: 'Panel de despacho — disponible en la web' },
  paperwork: { en: 'Paperwork scanner — available on the web', es: 'Escáner de papeles — disponible en la web' },
  transload: { en: 'Transload directory — available on the web', es: 'Directorio de transload — disponible en la web' },
  operator: { en: 'Operator console — available on the web', es: 'Panel de operador — disponible en la web' },
}

export default async function IOSNotAvailablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const fromRaw = typeof params.from === 'string' ? params.from : ''
  const fromKey = fromRaw.replace(/^\//, '').split('/')[0] || ''
  const title = TITLES[fromKey] || {
    en: 'This feature is available on the web',
    es: 'Esta función está disponible en la web',
  }

  // Detect Spanish-leaning client via Accept-Language so the fallback
  // matches the user's preference even though we're rendering server-side.
  const h = await headers()
  const acceptLang = (h.get('accept-language') || '').toLowerCase()
  const es = acceptLang.startsWith('es')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 mb-4">
          <span className="text-2xl">💻</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
          {es ? title.es : title.en}
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-snug">
          {es
            ? 'Esta función vive en cruzar.app desde tu computadora. La app de iPhone es para tiempos de espera, alertas y reportes — todo gratis.'
            : 'This feature lives at cruzar.app on a desktop browser. The iPhone app handles wait times, alerts, and reports — all free.'}
        </p>
        <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-left">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {es ? 'Desde la computadora' : 'From your computer'}
          </p>
          <p className="mt-1 text-sm font-mono text-gray-900 dark:text-gray-100">cruzar.app</p>
        </div>
        <Link
          href="/"
          className="mt-6 inline-block w-full py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-sm"
        >
          {es ? 'Volver al mapa' : 'Back to the map'}
        </Link>
      </div>
    </main>
  )
}
