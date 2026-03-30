'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PortCard } from './PortCard'
import { BorderMap } from './BorderMap'
import type { PortWaitTime } from '@/types'
import { RefreshCw, Map, List } from 'lucide-react'
import { ALL_REGIONS, getPortMeta } from '@/lib/portMeta'
import { useLang } from '@/lib/LangContext'

const REFRESH_INTERVAL = 5 * 60 * 1000

type Direction = 'entering_us' | 'entering_mexico'

export function PortList() {
  const router = useRouter()
  const { t } = useLang()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [cbpUpdatedAt, setCbpUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('All')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [direction, setDirection] = useState<Direction>('entering_us')

  const fetchPorts = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/ports', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPorts(data.ports)
      setFetchedAt(data.fetchedAt)
      setCbpUpdatedAt(data.cbpUpdatedAt ?? null)
      setError(null)
    } catch {
      setError('Could not load wait times. Showing cached data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPorts()
    const interval = setInterval(() => fetchPorts(), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchPorts])

  const filteredPorts = selectedRegion === 'All'
    ? ports
    : ports.filter(p => getPortMeta(p.portId).region === selectedRegion)

  // Group by region for list view
  const grouped = filteredPorts.reduce<Record<string, PortWaitTime[]>>((acc, port) => {
    const region = getPortMeta(port.portId).region
    if (!acc[region]) acc[region] = []
    acc[region].push(port)
    return acc
  }, {})

  const timeAgo = fetchedAt
    ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000 / 60)
    : null

  const cbpTime = cbpUpdatedAt
    ? new Date(cbpUpdatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Direction toggle */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
        <button
          onClick={() => setDirection('entering_us')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${direction === 'entering_us' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
        >
          {t.enteringUS}
        </button>
        <button
          onClick={() => setDirection('entering_mexico')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${direction === 'entering_mexico' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
        >
          {t.enteringMexico}
        </button>
      </div>

      {/* Entering Mexico — community only */}
      {direction === 'entering_mexico' && (
        <div className="space-y-3 mb-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t.mexicoSideTitle}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">{t.mexicoSideDesc}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t.communityTip}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{t.communityTipDesc}</p>
          </div>
        </div>
      )}

      {/* Entering US — full controls + list */}
      {direction === 'entering_us' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {error ? (
                <span className="text-amber-500">{error}</span>
              ) : cbpTime ? (
                <span>CBP data as of {cbpTime}</span>
              ) : timeAgo !== null ? (
                <span>{timeAgo === 0 ? t.updatedJustNow : t.updatedAgo(timeAgo)}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  <List className="w-3 h-3" /> {t.list}
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'map' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  <Map className="w-3 h-3" /> {t.map}
                </button>
              </div>
              <button
                onClick={() => fetchPorts(true)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                disabled={refreshing}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_REGIONS.map(r => (
                <option key={r} value={r}>{r === 'All' ? t.allRegions : r}</option>
              ))}
            </select>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 px-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" /> Live data
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" /> No data / closed
            </div>
          </div>

          {view === 'map' && (
            <div className="mb-4">
              <BorderMap
                ports={ports}
                selectedRegion={selectedRegion}
                onPortClick={(portId) => router.push(`/port/${encodeURIComponent(portId)}`)}
              />
              <p className="text-xs text-gray-500 mt-1.5 text-center">Tap a dot to see details</p>
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-5">
              {Object.entries(grouped).map(([region, regionPorts]) => (
                <div key={region}>
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {region}
                  </h2>
                  <div className="space-y-3">
                    {regionPorts.map(port => (
                      <PortCard key={`${port.portId}-${port.crossingName}`} port={port} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredPorts.length === 0 && !loading && (
            <p className="text-center text-gray-600 mt-10">No port data available.</p>
          )}
        </>
      )}
    </div>
  )
}
