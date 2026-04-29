'use client'

// Local error boundary for /insights — catches crashes that originate
// inside this route segment WITHOUT escalating to the global
// "Cruzar está caído" full-page panic. Reports to Sentry, then offers
// recovery (retry + back to /live).
//
// Common /insights crash sources we've seen:
//  - /live → /insights nav: stale client state / polling handle from
//    /live throws on /insights hydration (Diego flagged 2026-04-29)
//  - manifest snapshot cache miss when the JSON import revalidates
//  - third-party extension DOM injection (Honey, Grammarly) tripping
//    React 19 reconciler
//
// All three are recoverable via reset(). Showing them inside the page
// chrome (instead of global-error.tsx) keeps the user oriented.

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function InsightsError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { route: 'insights', boundary: 'insights/error.tsx' },
    })
  }, [error])

  return (
    <main className="min-h-screen bg-[#0a1020] text-slate-100 flex items-center justify-center px-5">
      <div className="max-w-md w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-amber-300/80 mb-3">
          /insights · momentary glitch
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">
          Insights se reinició · Insights restarted
        </h1>
        <p className="text-[13px] leading-[1.55] text-white/55 mb-5">
          Ya nos enteramos. Dale a Reintentar — la mayoría de las veces es un
          re-render y se arregla solo. · Logged. Most of the time this is just
          a re-render — Retry usually fixes it.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl bg-amber-400 text-[#0a1020] text-sm font-semibold hover:bg-amber-300 transition"
          >
            Reintentar · Retry
          </button>
          <Link
            href="/live"
            className="w-full py-2.5 rounded-xl border border-white/[0.12] text-white/75 text-sm font-medium hover:text-white hover:border-white/30 transition"
          >
            Ver /live · Open /live
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-[10px] font-mono text-white/35">ID: {error.digest}</p>
        )}
      </div>
    </main>
  )
}
