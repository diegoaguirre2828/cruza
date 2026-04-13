'use client'

import { useEffect, useState } from 'react'
import { getPortMeta } from '@/lib/portMeta'

// Admin tile: community-vs-CBP divergence. Shows how far community
// reports diverge from CBP readings at the same timestamps over
// the last 14 days. High absolute delta means one source is
// consistently wrong; sign of the delta tells you which.
//
// This is meta-data that informs how Cruzar should weight the two
// sources in its blended waits, AND it's the raw material for the
// kind of press story only Cruzar can tell ("CBP waits run 14 min
// ahead of reality at Hidalgo").

interface Divergence {
  samples: number
  avgDeltaMin: number | null
  absAvgDeltaMin: number | null
  byPort: Array<{
    portId: string
    samples: number
    avgDeltaMin: number
    absAvgDeltaMin: number
  }>
}

export function DivergenceTile() {
  const [data, setData] = useState<Divergence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/admin/divergence')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="mt-4 text-xs text-gray-400">Loading divergence…</p>
  if (error) return <p className="mt-4 text-xs text-red-500">Error: {error}</p>
  if (!data || data.samples === 0) {
    return (
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-700">Community vs CBP divergence</p>
        <p className="text-[11px] text-gray-400 italic mt-1">
          No paired samples yet. Needs community reports with wait_minutes + CBP readings at the same timestamps.
        </p>
      </div>
    )
  }

  const delta = data.avgDeltaMin ?? 0
  const abs = data.absAvgDeltaMin ?? 0
  const direction = delta > 0 ? 'high' : delta < 0 ? 'low' : 'neutral'

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">
        Community vs CBP divergence
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-black text-gray-900 tabular-nums">{data.samples}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase font-bold">paired samples</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-black tabular-nums ${direction === 'high' ? 'text-red-600' : direction === 'low' ? 'text-blue-600' : 'text-gray-900'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase font-bold">avg Δ (min)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-gray-900 tabular-nums">{abs}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase font-bold">|Δ| avg (min)</p>
        </div>
      </div>
      <p className="text-[11px] text-gray-600 mt-3 leading-snug">
        {direction === 'high'
          ? `Community reports run ${delta} min HIGHER than CBP on average — CBP may be lagging at peak moments.`
          : direction === 'low'
            ? `Community reports run ${Math.abs(delta)} min LOWER than CBP on average — CBP may be over-reporting or community is optimistic.`
            : `Community and CBP align on average. High |Δ| per-port means the variance is local rather than systemic.`}
      </p>

      {data.byPort.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-[11px] font-bold text-blue-600 hover:underline"
          >
            {expanded ? 'Hide per-port breakdown' : `Per-port breakdown (${data.byPort.length} ports) →`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {data.byPort.map((p) => {
                const meta = getPortMeta(p.portId)
                const name = meta.localName || meta.city || p.portId
                return (
                  <div key={p.portId} className="flex items-center justify-between text-[11px] border-t border-gray-100 pt-1">
                    <span className="font-bold text-gray-700 truncate flex-1 min-w-0 pr-2">
                      {name}
                    </span>
                    <span className="text-gray-400 tabular-nums w-10 text-right">{p.samples}x</span>
                    <span className={`font-black tabular-nums w-12 text-right ${p.avgDeltaMin > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {p.avgDeltaMin > 0 ? '+' : ''}{p.avgDeltaMin}m
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
