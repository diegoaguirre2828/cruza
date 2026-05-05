'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Map } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime } from '@/types'

interface Props {
  port: PortWaitTime
  portId: string
}

function waitColor(min: number | null | undefined): string {
  if (min == null) return 'text-white/25'
  if (min <= 20) return 'text-green-500 dark:text-green-400'
  if (min <= 45) return 'text-amber-500 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function heroNumColor(min: number | null | undefined): string {
  if (min == null) return 'text-gray-200 dark:text-white/15'
  if (min <= 20) return 'text-green-500 dark:text-green-400'
  if (min <= 45) return 'text-amber-500 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function glowColor(min: number | null | undefined): string {
  if (min == null) return 'rgba(107,114,128,0.12)'
  if (min <= 20) return 'rgba(34,197,94,0.14)'
  if (min <= 45) return 'rgba(245,158,11,0.14)'
  return 'rgba(239,68,68,0.14)'
}

function agoLabel(recordedAt: string | null, es: boolean): string {
  if (!recordedAt) return es ? 'En vivo' : 'Live'
  const diffMin = Math.round((Date.now() - new Date(recordedAt).getTime()) / 60000)
  if (diffMin <= 1) return es ? 'hace 1 min' : '1m ago'
  if (diffMin < 60) return es ? `hace ${diffMin} min` : `${diffMin}m ago`
  return es ? 'En vivo' : 'Live'
}

interface Trend { dir: 'up' | 'down' | 'stable'; delta: number }

export function BridgePageHeader({ port, portId }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [trend, setTrend] = useState<Trend | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/history`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const h: Array<{ recorded_at: string; vehicle_wait: number | null }> = data?.history
        if (!h || h.length < 2) return
        const latest = h[h.length - 1]
        const cutoff = new Date(Date.now() - 60 * 60 * 1000)
        const older = [...h].reverse().find(r => new Date(r.recorded_at) <= cutoff)
        if (!older) return
        const diff = (latest.vehicle_wait ?? 0) - (older.vehicle_wait ?? 0)
        if (diff >= 3) setTrend({ dir: 'up', delta: diff })
        else if (diff <= -3) setTrend({ dir: 'down', delta: Math.abs(diff) })
        else setTrend({ dir: 'stable', delta: 0 })
      })
      .catch(() => {})
  }, [portId])

  const primaryWait = port.vehicle
  const lanesOpen = port.vehicleLanesOpen
  const sourceLbl = port.source === 'community' ? (es ? 'Comunidad' : 'Community') : 'CBP'

  const lanes = [
    { key: 'car',    label: es ? 'Auto'   : 'Car',   value: port.vehicle },
    { key: 'sentri', label: 'SENTRI',                 value: port.sentri },
    { key: 'ped',    label: es ? 'A pie'  : 'Ped',   value: port.pedestrian },
    { key: 'truck',  label: es ? 'Camión' : 'Truck', value: port.commercial },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl px-4 pt-5 pb-4 bg-white dark:bg-[#161d2e] border border-gray-200 dark:border-white/[0.07]">
      {/* Atmospheric status glow */}
      <div
        className="absolute -top-12 -right-12 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${glowColor(primaryWait)} 0%, transparent 70%)`,
          filter: 'blur(32px)',
          animation: 'pulse 3s ease-in-out infinite',
        }}
      />

      {/* Name row + LIVE pill */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black text-gray-900 dark:text-white leading-tight font-display">
            {port.portName}
          </h1>
          {port.crossingName && (
            <p className="text-[11px] text-gray-400 dark:text-white/35 truncate mt-0.5">{port.crossingName}</p>
          )}
        </div>
        <span className="flex-shrink-0 flex items-center gap-1.5 text-[9px] font-mono font-semibold text-green-500 dark:text-green-400 border border-green-400/30 bg-green-400/[0.06] rounded-full px-2 py-1 uppercase tracking-wider mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Hero readout — big wait number + trend */}
      <div className="relative mt-3 flex items-end gap-2.5">
        <span className={`font-display font-black tabular-nums leading-none ${primaryWait != null && primaryWait >= 100 ? 'text-[52px]' : 'text-[64px]'} ${heroNumColor(primaryWait)}`}>
          {primaryWait ?? '—'}
        </span>
        <div className="mb-2.5 flex flex-col items-start gap-0.5">
          <span className="text-[11px] font-mono font-semibold text-gray-400 dark:text-white/40 uppercase tracking-wider">
            {es ? 'min' : 'min'}
          </span>
          {trend && trend.dir !== 'stable' && (
            <span className={`text-[10px] font-mono font-semibold leading-none ${trend.dir === 'up' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
              {trend.dir === 'up' ? '▲' : '▼'} {trend.delta}m {es ? 'vs 1h' : 'vs 1h'}
            </span>
          )}
        </div>
      </div>

      {/* Hero-meta compact row */}
      <p className="relative mt-1 text-[9px] font-mono font-medium text-gray-400 dark:text-white/30 uppercase tracking-[0.08em]">
        {[
          es ? 'Vehículos' : 'Vehicles',
          sourceLbl,
          agoLabel(port.recordedAt, es),
          lanesOpen != null ? (es ? `${lanesOpen} carriles` : `${lanesOpen} lanes`) : null,
        ].filter(Boolean).join(' · ')}
      </p>

      {/* Inline lane row with hairline separators */}
      <div className="relative mt-3 pt-3 border-t border-gray-200 dark:border-white/[0.07] flex flex-wrap">
        {lanes.map((lane, i) => (
          <div
            key={lane.key}
            className={`flex flex-col gap-0.5 pr-4 ${i > 0 ? 'pl-4 border-l border-gray-200 dark:border-white/[0.08]' : ''}`}
          >
            <span className="text-[9px] font-mono font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">
              {lane.label}
            </span>
            <span className={`text-[15px] font-black tabular-nums font-display leading-snug ${waitColor(lane.value)}`}>
              {lane.value != null ? `${lane.value}m` : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Smart route link */}
      <Link
        href={`/smart-route?from=${encodeURIComponent(portId)}`}
        className="relative mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] hover:border-blue-400 dark:hover:border-blue-500/40 transition-colors group"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex-shrink-0">
            <Map className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </span>
          <span className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
            {es ? 'Planifica tu cruce' : 'Plan your crossing'}
            <span className="font-medium text-gray-500 dark:text-white/30 ml-1">
              · {es ? 'puentes cercanos' : 'nearby bridges'}
            </span>
          </span>
        </span>
        <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">→</span>
      </Link>
    </div>
  )
}
