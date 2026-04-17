'use client'

import { useEffect, useState } from 'react'

interface Props {
  portId: string
  sharedMins: number
}

// Fetches the CURRENT wait from /api/ports once on mount, compares to the
// snapshot in the URL, and shows a small "está subiendo/bajando" pill.
// Deliberately no auto-refresh — this page is a share landing, not a
// live monitor. The CTA pushes users to /port/[id] for the live view.
export function ShareSnapshotLive({ portId, sharedMins }: Props) {
  const [liveMins, setLiveMins] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/ports', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const ports: Array<{ portId: string; vehicle: number | null }> = data.ports || []
        const found = ports.find((p) => p.portId === portId)
        if (!cancelled) {
          setLiveMins(found?.vehicle ?? null)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [portId])

  if (loading) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 animate-pulse">
        <div className="h-4 w-32 bg-white/5 rounded mb-2" />
        <div className="h-5 w-48 bg-white/5 rounded" />
      </div>
    )
  }

  if (liveMins === null) return null

  const diff = liveMins - sharedMins
  const pct = sharedMins > 0 ? Math.round((diff / sharedMins) * 100) : 0

  let message: string
  let tone: string
  if (Math.abs(diff) < 5) {
    message = `Sigue igual · ${liveMins} min ahorita`
    tone = 'text-white/80 bg-white/[0.05] border-white/15'
  } else if (diff > 0) {
    message = `Subió ${diff} min · ${liveMins} min ahorita`
    tone = 'text-red-400 bg-red-500/10 border-red-500/30'
  } else {
    message = `Bajó ${Math.abs(diff)} min · ${liveMins} min ahorita`
    tone = 'text-green-400 bg-green-500/10 border-green-500/30'
  }

  return (
    <div className={`mt-5 rounded-2xl border p-4 text-center ${tone}`}>
      <div className="text-[11px] font-bold uppercase tracking-widest opacity-70 mb-1">
        Ahorita mismo
      </div>
      <div className="text-sm font-bold">{message}</div>
      {Math.abs(pct) >= 20 && Math.abs(diff) >= 10 && (
        <div className="text-[11px] opacity-70 mt-1">
          {diff > 0 ? `+${pct}% vs. compartido` : `${pct}% vs. compartido`}
        </div>
      )}
    </div>
  )
}
