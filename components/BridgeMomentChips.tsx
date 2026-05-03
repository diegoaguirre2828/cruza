'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '@/lib/LangContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

interface Props {
  portId: string
  liveMin: number | null
}

interface Moment {
  key: string
  label: string
  value: string
  hint?: string
  tone: 'live' | 'forecast' | 'pattern'
}

const ROTATE_MS = 4500

function dayLabel(date: Date, es: boolean): string {
  const todayKey = new Date().toISOString().slice(0, 10)
  const targetKey = date.toISOString().slice(0, 10)
  if (todayKey === targetKey) return es ? 'Hoy' : 'Today'
  const diff = Math.round((date.getTime() - new Date(todayKey).getTime()) / (24 * 60 * 60 * 1000))
  if (diff === 1) return es ? 'Mañana' : 'Tomorrow'
  const dayNamesEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return (es ? dayNamesEs : dayNamesEn)[date.getUTCDay()]
}

function nextSaturday(): Date {
  const d = new Date()
  const day = d.getUTCDay()
  const delta = day === 6 ? 7 : (6 - day)
  d.setUTCDate(d.getUTCDate() + delta)
  return d
}

// Auto-rotating moment chip strip directly under the wait-time hero.
// Replaces the buried "Patterns / Data" tab. 4 rotating cards: now,
// next 6h trend, this Saturday, typical at this hour. Auto-advances
// every 4.5s; tap the dots or swipe to jump. Apple-Wallet card-stack
// energy. Diego 2026-05-02: "patterns and data tab can be higher up,
// like where near the current data is, if users want to see historical
// then boom, maybe in the same tab as the same day forecast 'this
// saturday' make it like a rotating thing."

export function BridgeMomentChips({ portId, liveMin }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [forecast6h, setForecast6h] = useState<number | null>(null)
  const [satForecast, setSatForecast] = useState<number | null>(null)
  const [typicalNow, setTypicalNow] = useState<number | null>(null)
  const [idx, setIdx] = useState(0)

  // Forecast 6h ahead
  useEffect(() => {
    fetchWithTimeout(`/api/predictions?portId=${encodeURIComponent(portId)}&horizon=6`, { cache: 'no-store' }, 5000)
      .then(r => r.ok ? r.json() : null)
      .then((d: { prediction_min?: number } | null) => {
        if (d?.prediction_min != null && Number.isFinite(d.prediction_min)) setForecast6h(Math.round(d.prediction_min))
      })
      .catch(() => {})
  }, [portId])

  // Saturday forecast at the same hour-of-day
  useEffect(() => {
    const sat = nextSaturday()
    sat.setUTCHours(new Date().getUTCHours())
    const horizon = Math.max(1, Math.round((sat.getTime() - Date.now()) / (60 * 60 * 1000)))
    if (horizon > 168) return // beyond 7 days, skip
    fetchWithTimeout(`/api/predictions?portId=${encodeURIComponent(portId)}&horizon=${horizon}`, { cache: 'no-store' }, 5000)
      .then(r => r.ok ? r.json() : null)
      .then((d: { prediction_min?: number } | null) => {
        if (d?.prediction_min != null && Number.isFinite(d.prediction_min)) setSatForecast(Math.round(d.prediction_min))
      })
      .catch(() => {})
  }, [portId])

  // Typical at this hour-of-day for this port
  useEffect(() => {
    fetchWithTimeout(`/api/ports/${encodeURIComponent(portId)}/best-times`, { cache: 'no-store' }, 5000)
      .then(r => r.ok ? r.json() : null)
      .then((d: { hours?: { hour: number; avg: number; dow?: number }[] } | null) => {
        const hours = d?.hours ?? []
        const now = new Date()
        const dow = now.getDay()
        const hour = now.getHours()
        const exact = hours.find(h => h.dow === dow && h.hour === hour)
                  || hours.find(h => h.hour === hour)
        if (exact?.avg != null) setTypicalNow(Math.round(exact.avg))
      })
      .catch(() => {})
  }, [portId])

  const moments = useMemo<Moment[]>(() => {
    const list: Moment[] = []
    if (liveMin != null) {
      list.push({
        key: 'now',
        label: es ? 'Ahora' : 'Right now',
        value: `${liveMin} min`,
        hint: es ? 'CBP en vivo' : 'Live CBP',
        tone: 'live',
      })
    }
    if (forecast6h != null && liveMin != null) {
      const arrow = forecast6h > liveMin ? '↑' : forecast6h < liveMin ? '↓' : '→'
      list.push({
        key: 'forecast6h',
        label: es ? 'En 6 horas' : 'In 6 hours',
        value: `${forecast6h} min ${arrow}`,
        hint: es
          ? (forecast6h > liveMin ? 'Subiendo' : forecast6h < liveMin ? 'Bajando' : 'Estable')
          : (forecast6h > liveMin ? 'Trending up' : forecast6h < liveMin ? 'Trending down' : 'Stable'),
        tone: 'forecast',
      })
    }
    if (satForecast != null) {
      list.push({
        key: 'saturday',
        label: es ? `Este ${dayLabel(nextSaturday(), true).toLowerCase()}` : `This ${dayLabel(nextSaturday(), false)}`,
        value: `${satForecast} min`,
        hint: es ? 'A esta misma hora' : 'Same hour of day',
        tone: 'forecast',
      })
    }
    if (typicalNow != null) {
      list.push({
        key: 'typical',
        label: es ? 'Típico ahora' : 'Typical now',
        value: `${typicalNow} min`,
        hint: es ? 'Promedio últimos 30 días' : '30-day average',
        tone: 'pattern',
      })
    }
    return list
  }, [liveMin, forecast6h, satForecast, typicalNow, es])

  useEffect(() => {
    if (moments.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % moments.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [moments.length])

  if (moments.length === 0) return null

  const current = moments[idx % moments.length]
  const toneClass =
    current.tone === 'live'      ? 'bg-blue-600 text-white border-blue-700' :
    current.tone === 'forecast'  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 border-indigo-200 dark:border-indigo-800' :
                                   'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800'
  const labelClass =
    current.tone === 'live' ? 'text-blue-200' :
    current.tone === 'forecast' ? 'text-indigo-600 dark:text-indigo-400' :
                                  'text-amber-600 dark:text-amber-400'

  return (
    <div className="mt-2 mb-3">
      <div className={`relative rounded-2xl border px-4 py-3.5 overflow-hidden ${toneClass}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className={`text-[10px] uppercase tracking-[0.18em] font-bold ${labelClass}`}>
                {current.label}
              </p>
              <p className="text-2xl font-black font-display leading-tight tabular-nums mt-0.5">
                {current.value}
              </p>
              {current.hint && (
                <p className="text-[11px] opacity-80 mt-0.5">{current.hint}</p>
              )}
            </div>
            {moments.length > 1 && (
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {moments.map((m, i) => (
                  <button
                    key={m.key}
                    onClick={() => setIdx(i)}
                    aria-label={m.label}
                    className={`w-1.5 rounded-full transition-all ${
                      i === idx
                        ? (current.tone === 'live' ? 'bg-white h-4' : 'bg-current h-4')
                        : (current.tone === 'live' ? 'bg-white/40 h-1.5' : 'bg-current/30 h-1.5')
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
