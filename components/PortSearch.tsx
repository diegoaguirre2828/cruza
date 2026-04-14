'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Search, X, Check } from 'lucide-react'
import { getPortMeta, type MegaRegion } from '@/lib/portMeta'
import { MEGA_REGION_LABELS } from '@/lib/useHomeRegion'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime } from '@/types'

// Display order for grouped empty state — biggest border markets first,
// then the smaller / more distant regions.
const REGION_ORDER: MegaRegion[] = [
  'rgv',
  'laredo',
  'coahuila-tx',
  'el-paso',
  'sonora-az',
  'baja',
  'other',
]

// Instant-search port picker — replaces the classic <select> dropdown with
// a type-ahead input that filters across port name, city, crossing name,
// local nickname, override, region, and port_id. Much faster for users who
// know their bridge by nickname ("puente nuevo") but wouldn't know to scroll
// to "Brownsville B&M" in a big list.

interface Props {
  ports: PortWaitTime[]
  value: string | null
  onChange: (portId: string) => void
  placeholder?: string
  /** Show live wait time next to each port in the results */
  showWait?: boolean
}

export function PortSearch({ ports, value, onChange, placeholder, showWait = true }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = value ? ports.find((p) => p.portId === value) : null

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  type IndexedPort = {
    port: PortWaitTime
    meta: ReturnType<typeof getPortMeta>
    effectiveLocal: string
    haystack: string
  }

  const indexed = useMemo<IndexedPort[]>(() => {
    return ports.map((p) => {
      const meta = getPortMeta(p.portId)
      const effectiveLocal = p.localNameOverride || meta.localName || ''
      const haystack = [
        p.portId,
        p.portName,
        p.crossingName,
        meta.city,
        meta.region,
        effectiveLocal,
      ]
        .filter(Boolean)
        .join(' · ')
        .toLowerCase()
      return { port: p, meta, effectiveLocal, haystack }
    })
  }, [ports])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] // Grouped view used instead — see `grouped` below

    // Score by: exact match on local name > starts-with on name > contains
    return indexed
      .filter((r) => r.haystack.includes(q))
      .sort((a, b) => {
        const aLocal = (a.effectiveLocal || '').toLowerCase()
        const bLocal = (b.effectiveLocal || '').toLowerCase()
        const aCity = a.meta.city.toLowerCase()
        const bCity = b.meta.city.toLowerCase()
        const score = (r: { haystack: string; effectiveLocal: string; meta: { city: string } }) => {
          const l = r.effectiveLocal.toLowerCase()
          const c = r.meta.city.toLowerCase()
          if (l === q) return 0
          if (l.startsWith(q)) return 1
          if (c === q) return 2
          if (c.startsWith(q)) return 3
          return 4
        }
        const diff = score(a) - score(b)
        if (diff !== 0) return diff
        return (aLocal || aCity).localeCompare(bLocal || bCity)
      })
      .slice(0, 50)
  }, [indexed, query])

  // Grouped view for the empty state: Region → City → Bridge.
  // Shown when the user hasn't typed anything yet, so they can
  // scan the hierarchy instead of scrolling a flat alphabetical
  // list of every crossing on the entire border.
  const grouped = useMemo(() => {
    const byRegion = new Map<MegaRegion, Map<string, IndexedPort[]>>()
    for (const entry of indexed) {
      const region = entry.meta.megaRegion
      if (!byRegion.has(region)) byRegion.set(region, new Map())
      const cityMap = byRegion.get(region)!
      const city = entry.meta.city || '—'
      if (!cityMap.has(city)) cityMap.set(city, [])
      cityMap.get(city)!.push(entry)
    }
    const result: Array<{
      region: MegaRegion
      cities: Array<{ city: string; ports: IndexedPort[] }>
    }> = []
    for (const region of REGION_ORDER) {
      const cityMap = byRegion.get(region)
      if (!cityMap || cityMap.size === 0) continue
      const cities = Array.from(cityMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([city, ports]) => ({
          city,
          ports: ports.sort((a, b) => {
            const an = (a.effectiveLocal || a.port.crossingName || a.port.portName).toLowerCase()
            const bn = (b.effectiveLocal || b.port.crossingName || b.port.portName).toLowerCase()
            return an.localeCompare(bn)
          }),
        }))
      result.push({ region, cities })
    }
    return result
  }, [indexed])

  function pick(portId: string) {
    onChange(portId)
    setQuery('')
    setFocused(false)
  }

  function clearSelection() {
    onChange('')
    setQuery('')
    setFocused(true)
  }

  const showList = focused
  const placeholderText =
    placeholder ||
    (es ? 'Busca tu puente — Hidalgo, Puente Nuevo, Tijuana…' : 'Search your bridge — Hidalgo, Puente Nuevo, Tijuana…')

  return (
    <div ref={containerRef} className="relative">
      {/* Display: either the selected port chip OR the search input */}
      {selected && !focused ? (
        <button
          type="button"
          onClick={() => setFocused(true)}
          className="w-full flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded-xl px-3 py-2.5 text-left hover:border-blue-400 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {selected.crossingName || selected.portName}
                {(selected.localNameOverride || getPortMeta(selected.portId).localName) && (
                  <span className="ml-1 text-gray-500 font-normal">
                    · {selected.localNameOverride || getPortMeta(selected.portId).localName}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {getPortMeta(selected.portId).city} · {getPortMeta(selected.portId).region}
              </p>
            </div>
          </div>
          <span
            role="button"
            aria-label="Clear"
            onClick={(e) => { e.stopPropagation(); clearSelection() }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholderText}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Results dropdown */}
      {showList && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
          {query.trim() ? (
            // ── Typing: flat scored list ──────────────────────────
            matches.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-4 text-center">
                {es ? 'Ningún puente encontrado' : 'No crossings found'}
              </p>
            ) : (
              matches.map((entry) => renderPortRow(entry))
            )
          ) : (
            // ── Empty: grouped Region → City → Bridge ─────────────
            grouped.map(({ region, cities }) => (
              <div key={region}>
                <div className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] uppercase tracking-widest font-black text-gray-600 dark:text-gray-300">
                    {es ? MEGA_REGION_LABELS[region].es : MEGA_REGION_LABELS[region].en}
                  </p>
                </div>
                {cities.map(({ city, ports: cityPorts }) => (
                  <div key={city}>
                    <div className="px-3 pt-2 pb-1 bg-white dark:bg-gray-800">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
                        {city}
                      </p>
                    </div>
                    {cityPorts.map((entry) => renderPortRow(entry))}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )

  function renderPortRow(entry: IndexedPort) {
    const { port, meta, effectiveLocal } = entry
    const primary = port.crossingName || port.portName
    const secondary = effectiveLocal || meta.city
    const waitLabel =
      port.vehicle == null ? '—' : port.vehicle === 0 ? '<1 min' : `${port.vehicle} min`
    const waitColor =
      port.vehicle == null
        ? 'text-gray-400'
        : port.vehicle <= 20
          ? 'text-green-600'
          : port.vehicle <= 45
            ? 'text-amber-600'
            : 'text-red-600'
    return (
      <button
        key={port.portId}
        type="button"
        onClick={() => pick(port.portId)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 border-b border-gray-100 dark:border-gray-700 last:border-0 ${
          value === port.portId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{primary}</p>
          {secondary && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{secondary}</p>
          )}
        </div>
        {showWait && (
          <span className={`text-xs font-bold tabular-nums ${waitColor} flex-shrink-0`}>
            {waitLabel}
          </span>
        )}
      </button>
    )
  }
}
