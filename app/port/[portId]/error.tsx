'use client'

// /port/[portId] error boundary — the port detail page is the
// highest-intent page in the app (every FB click lands here). If
// anything here throws, we want a graceful card with a retry AND a
// direct path back to the home list, not a white screen.

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PortError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 pt-10">
      <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm text-center">
        <div className="text-3xl mb-2">🚧</div>
        <h1 className="text-base font-black text-gray-900 dark:text-gray-100 mb-1">
          No pudimos cargar este puente · Couldn&apos;t load this crossing
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mb-4">
          Los datos del puente fallaron al cargar. Puedes volver al listado para ver los otros. · The crossing data failed to load. You can head back to the list to see the others.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-[0.98] transition-transform"
          >
            Reintentar · Try again
          </button>
          <Link
            href="/"
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold"
          >
            Ver todos los puentes · See all crossings
          </Link>
        </div>
        {error.digest && (
          <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
