'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

// Lightweight SVG border map. Pure-inline SVG with dots positioned by
// lat/lng — no React Leaflet, no tile fetches, no ~80KB dependency.
// This is the "map at the top" visual hook without hurting the spotty-
// connection work. Tap expands to the full Leaflet map at /negocios or
// a port detail page.
//
// Not meant to be geographically accurate — it's a schematic snapshot
// of "what the border looks like right now, color-coded." Users get the
// visual hit, the tap, and the exploration, without the weight.

interface Props {
  ports: PortWaitTime[] | null
}

// Approximate bbox that covers the whole US-Mexico border, from
// Tijuana (west) to Brownsville (east).
const BBOX = {
  minLng: -117.2,
  maxLng: -97.2,
  minLat: 25.8,
  maxLat: 33.0,
}
const VIEW_W = 320
const VIEW_H = 90

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * VIEW_W
  const y = VIEW_H - ((lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * VIEW_H
  return { x, y }
}

function dotColor(wait: number | null, isClosed: boolean): string {
  if (isClosed) return '#6b7280'
  if (wait == null) return '#9ca3af'
  if (wait <= 20) return '#22c55e'
  if (wait <= 45) return '#f59e0b'
  return '#ef4444'
}

export function StaticBorderMap({ ports }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  const dots = useMemo(() => {
    if (!ports) return []
    const seen = new Set<string>()
    const out: Array<{
      portId: string
      x: number
      y: number
      color: string
      name: string
    }> = []
    for (const p of ports) {
      const meta = getPortMeta(p.portId)
      if (!meta.lat || !meta.lng) continue
      // Dedupe multiple entries at nearly the same spot (common for RGV).
      const key = `${meta.lat.toFixed(2)}:${meta.lng.toFixed(2)}`
      if (seen.has(key)) continue
      seen.add(key)
      const { x, y } = project(meta.lat, meta.lng)
      out.push({
        portId: p.portId,
        x,
        y,
        color: dotColor(p.vehicle ?? null, !!p.isClosed),
        name: meta.localName || p.portName,
      })
    }
    return out
  }, [ports])

  if (dots.length === 0) return null

  // Count the three state buckets so we can show a tiny legend tally.
  const green = dots.filter((d) => d.color === '#22c55e').length
  const amber = dots.filter((d) => d.color === '#f59e0b').length
  const red = dots.filter((d) => d.color === '#ef4444').length

  return (
    <Link
      href="#port-list"
      className="mt-3 block bg-gradient-to-b from-sky-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 active:scale-[0.99] transition-transform shadow-sm"
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
          {es ? '🌎 Toda la frontera ahorita' : '🌎 The whole border right now'}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] font-bold tabular-nums">
          <span className="text-green-600 dark:text-green-400">●{green}</span>
          <span className="text-amber-600 dark:text-amber-400">●{amber}</span>
          <span className="text-red-600 dark:text-red-400">●{red}</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        aria-label={es ? 'Mapa esquemático de la frontera' : 'Schematic border map'}
      >
        {/* Subtle baseline showing the border curve */}
        <path
          d={`M 0 ${VIEW_H * 0.7} Q ${VIEW_W * 0.25} ${VIEW_H * 0.3} ${VIEW_W * 0.55} ${VIEW_H * 0.5} T ${VIEW_W} ${VIEW_H * 0.85}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 3"
          className="text-gray-300 dark:text-gray-700"
        />
        {/* Dots */}
        {dots.map((d) => (
          <g key={d.portId}>
            <circle cx={d.x} cy={d.y} r="4.5" fill={d.color} opacity="0.35" />
            <circle cx={d.x} cy={d.y} r="2.5" fill={d.color} />
          </g>
        ))}
      </svg>
      <p className="mt-1 text-center text-[10px] text-gray-400">
        {es ? 'Toca para ver la lista completa ↓' : 'Tap to see the full list ↓'}
      </p>
    </Link>
  )
}
