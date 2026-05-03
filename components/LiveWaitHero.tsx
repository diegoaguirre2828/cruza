'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

interface Props {
  port: {
    vehicle: number | null
    sentri: number | null
    pedestrian: number | null
    commercial: number | null
    recordedAt?: string | null
  }
}

interface HourBucket {
  hour: number
  avgWait: number | null
  todayAvg: number | null
}

// Primary live-wait hero — separated from BridgeMomentChips per Diego
// 2026-05-02: "the actual wait times has to be separate and not
// rotating." Stays put; carousel below handles patterns/forecast.

export function LiveWaitHero({ port, portId }: Props & { portId: string }) {
  const { lang } = useLang()
  const es = lang === 'es'
  const liveMin = port.vehicle ?? null

  const [todayHours, setTodayHours] = useState<HourBucket[] | null>(null)

  useEffect(() => {
    fetchWithTimeout(`/api/ports/${encodeURIComponent(portId)}/hourly`, { cache: 'no-store' }, 6000)
      .then(r => r.ok ? r.json() : null)
      .then((d: { hours?: HourBucket[] } | null) => {
        if (!d?.hours) return
        setTodayHours(d.hours)
      })
      .catch(() => {})
  }, [portId])

  const verdict = useMemo(() => {
    if (liveMin == null || !todayHours) return null
    const currentHour = new Date().getHours()
    const sameHour = todayHours.find(h => h.hour === currentHour)
    const typical = sameHour?.todayAvg ?? sameHour?.avgWait ?? null
    if (typical == null) return null
    const diff = liveMin - typical
    if (Math.abs(diff) <= 5) return { tone: 'neutral' as const, text: es ? 'Como un día normal' : 'About average' }
    if (diff < 0) return { tone: 'good' as const, text: es ? `${Math.abs(diff)} min mejor que lo típico` : `${Math.abs(diff)} min better than typical` }
    return { tone: 'bad' as const, text: es ? `${diff} min más lento que lo típico` : `${diff} min slower than typical` }
  }, [liveMin, todayHours, es])

  const updatedAgo = useMemo(() => {
    if (!port.recordedAt) return null
    const ms = Date.now() - new Date(port.recordedAt).getTime()
    const min = Math.max(0, Math.round(ms / 60000))
    if (min < 1) return es ? 'ahora' : 'just now'
    if (min === 1) return es ? '1 min' : '1 min ago'
    return es ? `${min} min` : `${min} min ago`
  }, [port.recordedAt, es])

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 px-5 py-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-gray-500 dark:text-gray-400">
          {es ? 'Ahora' : 'Right now'}
        </p>
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
          {updatedAgo ? (es ? `actualizado ${updatedAgo}` : `updated ${updatedAgo}`) : 'CBP'}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-1">
        <p className="text-[64px] leading-none font-black font-display tabular-nums text-gray-900 dark:text-gray-100">
          {liveMin != null ? liveMin : '—'}
          <span className="text-2xl opacity-70 ml-1.5 font-bold">min</span>
        </p>
      </div>

      {verdict && (
        <p className={`mt-1 text-sm font-bold ${
          verdict.tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
          verdict.tone === 'bad' ? 'text-red-600 dark:text-red-400' :
          'text-gray-600 dark:text-gray-400'
        }`}>
          {verdict.text}
        </p>
      )}

      <div className="grid grid-cols-4 gap-1.5 mt-4">
        {([
          { lane: 'SENTRI', value: port.sentri },
          { lane: es ? 'Auto' : 'Car', value: port.vehicle },
          { lane: es ? 'A pie' : 'Walk', value: port.pedestrian },
          { lane: es ? 'Camión' : 'Truck', value: port.commercial },
        ]).map((l) => (
          <div
            key={l.lane}
            className="rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1.5 text-center"
          >
            <p className="text-[9px] uppercase tracking-wider opacity-60 font-bold text-gray-700 dark:text-gray-300">{l.lane}</p>
            <p className="text-[13px] font-black tabular-nums mt-0.5 text-gray-900 dark:text-gray-100">
              {l.value != null ? `${l.value}m` : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
