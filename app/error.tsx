'use client'

// Root-level error boundary — catches any unhandled exception from a
// server component, layout, or page that doesn't have its own
// error.tsx nearer the route. Without this file, Next.js falls back
// to its default dev-style error page, which renders as a white
// screen with stack trace text to end users in production — looks
// broken rather than degraded.
//
// Sentry captures the exception via captureUnderscoreErrorException
// (already wired in sentry.server.config.ts + instrumentation.ts), so
// this component is purely the user-facing graceful-degradation UI.

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm text-center">
        <div className="text-4xl mb-3">🌉</div>
        <h1 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-1">
          Algo falló · Something broke
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mb-5">
          Tuvimos un problema cargando esta página. Ya nos enteramos. · We had trouble loading this page. We&apos;re on it.
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
            Volver al inicio · Back to home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
