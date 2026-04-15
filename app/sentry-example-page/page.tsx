'use client'

import * as Sentry from '@sentry/nextjs'
import { useState } from 'react'

// Sentry verification page — hit this after setting NEXT_PUBLIC_SENTRY_DSN
// in Vercel env vars to verify error capture is live. Delete once you've
// seen the first real event land in the Sentry Issues dashboard.
export default function SentryExamplePage() {
  const [status, setStatus] = useState<'idle' | 'triggered' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function triggerClientError() {
    setStatus('triggered')
    try {
      // Intentional undefined function call — this will throw and the
      // client-side Sentry SDK will capture it.
      // @ts-expect-error deliberate error for Sentry verification
      myUndefinedFunction()
    } catch (e) {
      Sentry.captureException(e)
      setStatus('done')
    }
  }

  async function triggerServerError() {
    setStatus('triggered')
    setError(null)
    try {
      const res = await fetch('/api/sentry-example-api')
      if (!res.ok) {
        throw new Error(`Server route returned ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setStatus('done')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
          Sentry verification
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tap a button, then check the Sentry dashboard at{' '}
          <a
            href="https://cruzar.sentry.io/issues/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            cruzar.sentry.io/issues
          </a>{' '}
          to confirm the error shows up.
        </p>

        <button
          onClick={triggerClientError}
          className="w-full rounded-xl bg-red-600 text-white font-bold py-3 active:scale-95"
        >
          Trigger client-side error
        </button>

        <button
          onClick={triggerServerError}
          className="w-full rounded-xl bg-orange-600 text-white font-bold py-3 active:scale-95"
        >
          Trigger server-side error
        </button>

        {status === 'done' && (
          <p className="text-sm text-green-700 dark:text-green-400 text-center">
            ✅ Error dispatched to Sentry. Check the Issues dashboard.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 text-center">
            Server error: {error}
          </p>
        )}
      </div>
    </main>
  )
}
