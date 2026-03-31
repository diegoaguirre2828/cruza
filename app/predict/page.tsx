'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { ArrowLeft, Clock, TrendingDown, Calendar, Info, Lock } from 'lucide-react'

interface PortOption {
  portId: string
  portName: string
  crossingName: string
}

interface HourAvg {
  day: number
  hour: number
  vehicleAvg: number | null
  commercialAvg: number | null
  samples: number
}

interface PortResult {
  dayAverages: HourAvg[]
  bestHour: { day: number; hour: number; vehicleAvg: number; samples: number } | null
  weekHeatmap: Array<{ day: number; hour: number; level: 'low' | 'medium' | 'high' | 'none' }>
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

const LEVEL_COLORS = {
  low:    'bg-green-400',
  medium: 'bg-yellow-400',
  high:   'bg-red-400',
  none:   'bg-gray-100 dark:bg-gray-700',
}

const LEVEL_TEXT = {
  low:    'text-green-700',
  medium: 'text-yellow-700',
  high:   'text-red-700',
  none:   'text-gray-400',
}

export default function PredictPage() {
  const { user } = useAuth()
  const { tier } = useTier()
  const isPro = tier === 'pro' || tier === 'business'

  const [ports, setPorts] = useState<PortOption[]>([])
  const [selectedPorts, setSelectedPorts] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay())
  const [results, setResults] = useState<Record<string, PortResult>>({})
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'heatmap' | 'chart' | 'compare'>('compare')

  // Load available ports
  useEffect(() => {
    fetch('/api/ports')
      .then(r => r.json())
      .then(d => {
        const opts = (d.ports || []).map((p: { portId: string; portName: string; crossingName: string }) => ({
          portId: p.portId,
          portName: p.portName,
          crossingName: p.crossingName,
        }))
        setPorts(opts)
        // Default: select first 3 ports
        setSelectedPorts(opts.slice(0, 3).map((p: PortOption) => p.portId))
      })
  }, [])

  // Load predictions when ports or day changes
  useEffect(() => {
    if (selectedPorts.length === 0) return
    if (!isPro) return

    setLoading(true)
    fetch(`/api/predict?portIds=${selectedPorts.join(',')}&day=${selectedDay}`)
      .then(r => r.json())
      .then(d => {
        setResults(d.results || {})
        setHasData(d.hasData ?? false)
      })
      .finally(() => setLoading(false))
  }, [selectedPorts, selectedDay, isPro])

  function togglePort(portId: string) {
    setSelectedPorts(prev =>
      prev.includes(portId) ? prev.filter(p => p !== portId) : [...prev, portId].slice(0, 5)
    )
  }

  function getHeatCell(result: PortResult, day: number, hour: number) {
    return result.weekHeatmap.find(c => c.day === day && c.hour === hour)?.level ?? 'none'
  }

  function getAvg(result: PortResult, day: number, hour: number): number | null {
    return result.dayAverages.find(d => d.day === day && d.hour === hour)?.vehicleAvg ?? null
  }

  // For compare view: get sorted hours for selected day
  function getBestHoursForDay(portId: string): HourAvg[] {
    const result = results[portId]
    if (!result) return []
    return result.dayAverages
      .filter(d => d.day === selectedDay && d.vehicleAvg !== null)
      .sort((a, b) => (a.vehicleAvg ?? 999) - (b.vehicleAvg ?? 999))
      .slice(0, 6)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 pb-16">
        {/* Header */}
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Smart Crossing Planner</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Find the best time to cross — based on historical wait patterns</p>
          </div>
        </div>

        {/* Pro gate */}
        {!isPro && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 mb-5">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-purple-800 dark:text-purple-300">Pro Feature: Smart Crossing Planner</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 mb-3">
                  See predicted wait times for any crossing, any day of the week — based on months of historical data.
                  Plan your crossings days in advance to avoid peak hours.
                </p>
                <div className="space-y-1.5 mb-4">
                  {[
                    'Week-view heatmap: see which hours are fastest at a glance',
                    'Compare multiple crossings side-by-side',
                    'Best time recommendation with confidence level',
                    'Commercial (truck) wait predictions',
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-purple-500 text-xs">✓</span>
                      <span className="text-xs text-purple-700 dark:text-purple-300">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/pricing" className="inline-block text-xs font-semibold text-white bg-purple-600 px-5 py-2.5 rounded-xl hover:bg-purple-700 transition-colors">
                  Upgrade to Pro →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Port selector */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Select crossings to compare (up to 5)
          </p>
          <div className="flex flex-wrap gap-2">
            {ports.map(p => (
              <button
                key={p.portId}
                onClick={() => isPro && togglePort(p.portId)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  selectedPorts.includes(p.portId)
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                } ${!isPro ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
              >
                {p.portName}
              </button>
            ))}
          </div>
        </div>

        {/* Day selector */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Day of week</p>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => isPro && setSelectedDay(i)}
                className={`py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedDay === i
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                } ${!isPro ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* View tabs */}
        {isPro && (
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
            {[
              { key: 'compare', label: 'Best Hours' },
              { key: 'heatmap', label: 'Week Heatmap' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setView(t.key as typeof view)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  view === t.key
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>
        )}

        {/* No data message */}
        {!loading && isPro && hasData === false && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Not enough historical data yet</p>
            <p className="text-xs text-gray-400 mt-1">
              The prediction engine needs a few weeks of data to build accurate patterns.
              Check back soon — data is collected every 15 minutes.
            </p>
          </div>
        )}

        {/* COMPARE VIEW */}
        {!loading && isPro && hasData && view === 'compare' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Showing best hours for {DAYS_FULL[selectedDay]} based on historical averages
            </p>

            {selectedPorts.map(portId => {
              const port = ports.find(p => p.portId === portId)
              const result = results[portId]
              const bestHours = getBestHoursForDay(portId)

              return (
                <div key={portId} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{port?.portName}</p>
                      <p className="text-xs text-gray-400">{port?.crossingName}</p>
                    </div>
                    {result?.bestHour && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Best time</p>
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">
                          {formatHour(result.bestHour.hour)} · ~{result.bestHour.vehicleAvg}m
                        </p>
                      </div>
                    )}
                  </div>

                  {bestHours.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">No data for {DAYS_FULL[selectedDay]} yet</div>
                  ) : (
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-2">
                        {bestHours.map((h, i) => (
                          <div key={`${h.day}-${h.hour}`} className={`rounded-xl p-3 text-center ${i === 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700'}`}>
                            <p className={`text-xs font-bold ${i === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {i === 0 && '✓ '}{formatHour(h.hour)}
                            </p>
                            <p className={`text-xl font-bold mt-0.5 ${i === 0 ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {h.vehicleAvg}m
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">avg car</p>
                            {h.commercialAvg !== null && (
                              <p className="text-xs text-gray-400">{h.commercialAvg}m truck</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Mini hour bar chart */}
                      <div className="mt-3">
                        <p className="text-xs text-gray-400 mb-1.5">Wait by hour ({DAYS_FULL[selectedDay]})</p>
                        <div className="flex items-end gap-0.5 h-12">
                          {HOURS.map(hour => {
                            const a = getAvg(result, selectedDay, hour)
                            const maxH = 60
                            const barH = a !== null ? Math.min((a / maxH) * 100, 100) : 0
                            const color = a === null ? 'bg-gray-100 dark:bg-gray-700' : a < 20 ? 'bg-green-400' : a < 45 ? 'bg-yellow-400' : 'bg-red-400'
                            const isSelected = hour === new Date().getHours()
                            return (
                              <div key={hour} className="flex-1 flex flex-col items-center justify-end">
                                <div
                                  className={`w-full rounded-t-sm ${color} ${isSelected ? 'ring-1 ring-blue-400' : ''}`}
                                  style={{ height: `${Math.max(barH, a !== null ? 4 : 1)}%` }}
                                  title={a !== null ? `${formatHour(hour)}: ~${a}m` : `${formatHour(hour)}: no data`}
                                />
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                          <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* HEATMAP VIEW */}
        {!loading && isPro && hasData && view === 'heatmap' && selectedPorts.length > 0 && (
          <div className="space-y-6">
            {selectedPorts.map(portId => {
              const port = ports.find(p => p.portId === portId)
              const result = results[portId]
              if (!result) return null

              // We need full week data — refetch without day filter
              // For now, show what we have
              const hoursToShow = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

              return (
                <div key={portId} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{port?.portName}</p>
                    <p className="text-xs text-gray-400">{port?.crossingName}</p>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left text-gray-400 font-normal pr-3 py-1 w-10">Hour</th>
                          {DAYS.map(d => (
                            <th key={d} className="text-center text-gray-400 font-normal px-1 py-1">{d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hoursToShow.map(hour => (
                          <tr key={hour}>
                            <td className="text-gray-400 pr-3 py-0.5 text-xs">{formatHour(hour)}</td>
                            {DAYS.map((_, dayIdx) => {
                              const cell = result.weekHeatmap.find(c => c.day === dayIdx && c.hour === hour)
                              const level = cell?.level ?? 'none'
                              const avg = result.dayAverages.find(d => d.day === dayIdx && d.hour === hour)?.vehicleAvg
                              return (
                                <td key={dayIdx} className="px-1 py-0.5 text-center">
                                  <div
                                    className={`w-full h-6 rounded flex items-center justify-center text-xs font-medium ${
                                      level === 'none' ? 'bg-gray-50 dark:bg-gray-700 text-gray-300' :
                                      level === 'low'  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                      level === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    }`}
                                    title={avg != null ? `~${avg}m` : 'No data'}
                                  >
                                    {avg != null ? avg : '—'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-3 mt-3">
                      {[
                        { level: 'low',    label: 'Fast (<20m)',     color: 'bg-green-100 text-green-700' },
                        { level: 'medium', label: 'Moderate (20-45m)', color: 'bg-yellow-100 text-yellow-700' },
                        { level: 'high',   label: 'Slow (>45m)',     color: 'bg-red-100 text-red-700' },
                      ].map(l => (
                        <div key={l.level} className="flex items-center gap-1">
                          <span className={`w-3 h-3 rounded ${l.color} inline-block`} />
                          <span className="text-xs text-gray-400">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Free user preview (blurred) */}
        {!isPro && (
          <div className="relative">
            <div className="blur-sm pointer-events-none select-none" aria-hidden>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 p-4 shadow-sm mb-4">
                <p className="text-sm font-bold mb-2 text-gray-900">Pharr-Reynosa International Bridge</p>
                <div className="grid grid-cols-3 gap-2">
                  {['6am', '10am', '2pm'].map(t => (
                    <div key={t} className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-xs font-bold text-green-600">{t}</p>
                      <p className="text-xl font-bold text-green-700">12m</p>
                      <p className="text-xs text-gray-400">avg car</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-lg text-center max-w-xs">
                <Lock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Upgrade to Pro</p>
                <p className="text-xs text-gray-500 mt-1 mb-3">Unlock the Smart Crossing Planner and stop guessing when to go.</p>
                <Link href="/pricing" className="inline-block text-xs font-semibold text-white bg-purple-600 px-5 py-2 rounded-xl hover:bg-purple-700 transition-colors">
                  See Pro Plans →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
