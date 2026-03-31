'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PortCard } from './PortCard'
import { BorderMap } from './BorderMap'
import type { PortWaitTime } from '@/types'
import { RefreshCw, Map, List, Navigation, X } from 'lucide-react'
import { ALL_REGIONS, getPortMeta } from '@/lib/portMeta'
import { useLang } from '@/lib/LangContext'

const REFRESH_INTERVAL = 5 * 60 * 1000

type Direction = 'entering_us' | 'entering_mexico'

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distLabel(mi: number, lang: string): string {
  if (mi < 0.5) return lang === 'es' ? 'Muy cerca' : 'Very close'
  if (mi < 1) return lang === 'es' ? `${(mi * 5280).toFixed(0)} pies` : `${(mi * 5280).toFixed(0)} ft`
  return `${mi.toFixed(1)} mi`
}

export function PortList() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [cbpUpdatedAt, setCbpUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('All')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [direction, setDirection] = useState<Direction>('entering_us')

  // Near Me
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [nearMe, setNearMe] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

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

  function requestNearMe() {
    if (nearMe) {
      setNearMe(false)
      setGeoError(null)
      return
    }
    if (!navigator.geolocation) {
      setGeoError(lang === 'es' ? 'Geolocalización no disponible' : 'Geolocation not available')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setNearMe(true)
        setGeoLoading(false)
      },
      () => {
        setGeoError(lang === 'es' ? 'No se pudo obtener tu ubicación' : 'Could not get your location')
        setGeoLoading(false)
      },
      { timeout: 8000 }
    )
  }

  const filteredPorts = selectedRegion === 'All'
    ? ports
    : ports.filter(p => getPortMeta(p.portId).region === selectedRegion)

  // Sorted by distance when Near Me is active
  const sortedByDistance = userLoc
    ? [...ports]
        .map(p => ({ port: p, dist: haversineMi(userLoc.lat, userLoc.lng, getPortMeta(p.portId).lat, getPortMeta(p.portId).lng) }))
        .sort((a, b) => a.dist - b.dist)
    : []

  // Group by region for normal list view
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

          {/* Near Me + Region selector row */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={requestNearMe}
                disabled={geoLoading}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors flex-shrink-0 ${
                  nearMe
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                {geoLoading ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : nearMe ? (
                  <X className="w-3 h-3" />
                ) : (
                  <Navigation className="w-3 h-3" />
                )}
                {lang === 'es' ? 'Cerca de mí' : 'Near Me'}
              </button>

              {!nearMe && (
                <select
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">{lang === 'es' ? '🗺️ Todos los cruces' : '🗺️ All crossings'}</option>
                  {ALL_REGIONS.filter(r => r !== 'All' && r !== 'Other').map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}

              {nearMe && (
                <p className="flex-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {lang === 'es' ? 'Ordenado por distancia a ti' : 'Sorted by distance from you'}
                </p>
              )}
            </div>

            {geoError && (
              <p className="text-xs text-red-500 dark:text-red-400 px-1">{geoError}</p>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 px-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" /> {t.legendNoWait}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" /> {t.midMin}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" /> {t.overMin}
            </div>
          </div>

          {view === 'map' && (
            <div className="mb-4">
              <BorderMap
                ports={ports}
                selectedRegion={selectedRegion}
                onPortClick={(portId) => router.push(`/port/${encodeURIComponent(portId)}`)}
              />
              <p className="text-xs text-gray-500 mt-1.5 text-center">{t.tapDot}</p>
            </div>
          )}

          {/* Near Me sorted list */}
          {view === 'list' && nearMe && userLoc && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {lang === 'es' ? 'Más cercanos a ti' : 'Nearest to you'}
              </h2>
              {sortedByDistance.map(({ port, dist }) => (
                <div key={`${port.portId}-${port.crossingName}`}>
                  <p className="text-xs text-gray-400 dark:text-gray-500 px-1 mb-1 font-medium">
                    {distLabel(dist, lang)} · {getPortMeta(port.portId).city}
                  </p>
                  <PortCard port={port} />
                </div>
              ))}
            </div>
          )}

          {/* Normal grouped list */}
          {view === 'list' && !nearMe && (
            <div className="space-y-5">
              {Object.entries(grouped).map(([region, regionPorts]) => (
                <div key={region}>
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {region === 'Other' ? (lang === 'es' ? 'Otros' : 'Other') : region}
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

          {filteredPorts.length === 0 && !loading && !nearMe && (
            <p className="text-center text-gray-600 mt-10">No port data available.</p>
          )}
        </>
      )}
    </div>
  )
}
