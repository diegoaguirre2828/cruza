'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '@/lib/LangContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

interface Props {
  portId: string
  liveMin: number | null
}

interface HourBucket {
  hour: number
  avgWait: number | null
  todayAvg: number | null
  samples: number
}

interface HourlyResponse {
  hours: HourBucket[]
  peak: { hour: number; avgWait: number } | null
  best: { hour: number; avgWait: number } | null
}

const ROTATE_MS = 5500
const DAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmtHour(h: number, es: boolean): string {
  if (es) {
    if (h === 0) return '12 AM'
    if (h === 12) return '12 PM'
    return h < 12 ? `${h} AM` : `${h - 12} PM`
  }
  return `${((h + 11) % 12) + 1}${h < 12 ? 'AM' : 'PM'}`
}

function nextSaturday(): Date {
  const d = new Date()
  const day = d.getDay()
  const delta = day === 6 ? 7 : (6 - day)
  d.setDate(d.getDate() + delta)
  return d
}

function severityClass(wait: number | null): string {
  if (wait == null) return 'bg-gray-300/30 dark:bg-gray-600/40'
  if (wait <= 20) return 'bg-emerald-500'
  if (wait <= 30) return 'bg-lime-500'
  if (wait <= 45) return 'bg-amber-500'
  if (wait <= 60) return 'bg-orange-500'
  return 'bg-red-600'
}

// HourlyBarChart — inline 24-bar mini-chart used inside the moment cards.
// Renders today/saturday hourly pattern, current hour highlighted with a
// subtle pulsing ring. Heights normalized to maxWait. Tap to see hour
// label inline. Matches the THIS SATURDAY pattern Diego flagged
// 2026-05-02 as "what good looks like."
function HourlyBars({
  hours,
  highlightHour,
  liveMin,
}: {
  hours: HourBucket[]
  highlightHour?: number | null
  liveMin?: number | null
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const maxWait = useMemo(
    () => hours.reduce((m, h) => (h.todayAvg != null && h.todayAvg > m ? h.todayAvg : (h.avgWait != null && h.avgWait > m ? h.avgWait : m)), 0),
    [hours],
  )
  const focus = hovered ?? highlightHour ?? null
  const focusBucket = focus != null ? hours.find(h => h.hour === focus) : null
  const focusValue = focusBucket?.todayAvg ?? focusBucket?.avgWait ?? null

  return (
    <div className="w-full">
      <div className="flex items-end gap-[3px] h-[68px] mt-1">
        {hours.map((h) => {
          const v = h.todayAvg ?? h.avgWait ?? null
          const heightPct = v != null && maxWait > 0 ? Math.max(8, Math.round((v / maxWait) * 100)) : 6
          const isFocus = h.hour === focus
          return (
            <button
              key={h.hour}
              type="button"
              onClick={() => setHovered(h.hour)}
              aria-label={`${fmtHour(h.hour, false)}: ${v ?? 'n/a'} min`}
              className={`relative flex-1 rounded-sm ${severityClass(v)} ${isFocus ? 'ring-2 ring-white/80 dark:ring-white/60' : ''}`}
              style={{ height: `${heightPct}%`, minHeight: 6 }}
            />
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] font-medium opacity-70 tabular-nums">
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
      </div>
      {focus != null && focusValue != null && (
        <p className="mt-1 text-[11px] font-semibold text-center opacity-80">
          {fmtHour(focus, false)} · <span className="font-mono">{focusValue}m</span>
          {liveMin != null && focusValue !== liveMin && (
            <span className="ml-1.5 opacity-70">
              ({focusValue > liveMin ? '+' : ''}{focusValue - liveMin}m vs ahora)
            </span>
          )}
        </p>
      )}
    </div>
  )
}

interface Moment {
  key: string
  label: string
  badge: string | null
  body: React.ReactNode
}

// Rotating moment carousel — the "patterns/data as carousel" Diego asked
// for 2026-05-02. Replaces the buried Patterns & data details disclosure
// + the early single-number chip strip. Each card renders rich visuals
// (hourly sparkline bars, trend numbers) instead of plain text. Cards
// rotate every ~5.5s; tap dots to jump.

export function BridgeMomentChips({ portId, liveMin }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [todayHours, setTodayHours] = useState<HourBucket[] | null>(null)
  const [todayBest, setTodayBest] = useState<{ hour: number; avgWait: number } | null>(null)
  const [todayPeak, setTodayPeak] = useState<{ hour: number; avgWait: number } | null>(null)
  const [satHours, setSatHours] = useState<HourBucket[] | null>(null)
  const [forecast6h, setForecast6h] = useState<number | null>(null)
  const [idx, setIdx] = useState(0)

  // Today's pattern + best/peak
  useEffect(() => {
    fetchWithTimeout(`/api/ports/${encodeURIComponent(portId)}/hourly`, { cache: 'no-store' }, 6000)
      .then(r => r.ok ? r.json() : null)
      .then((d: HourlyResponse | null) => {
        if (!d?.hours) return
        setTodayHours(d.hours)
        setTodayBest(d.best)
        setTodayPeak(d.peak)
      })
      .catch(() => {})
  }, [portId])

  // Saturday pattern (dow=6)
  useEffect(() => {
    fetchWithTimeout(`/api/ports/${encodeURIComponent(portId)}/hourly?dow=6`, { cache: 'no-store' }, 6000)
      .then(r => r.ok ? r.json() : null)
      .then((d: HourlyResponse | null) => {
        if (!d?.hours) return
        setSatHours(d.hours)
      })
      .catch(() => {})
  }, [portId])

  // 6h forecast
  useEffect(() => {
    fetchWithTimeout(`/api/predictions?portId=${encodeURIComponent(portId)}&horizon=6`, { cache: 'no-store' }, 5000)
      .then(r => r.ok ? r.json() : null)
      .then((d: { prediction_min?: number } | null) => {
        if (d?.prediction_min != null && Number.isFinite(d.prediction_min)) setForecast6h(Math.round(d.prediction_min))
      })
      .catch(() => {})
  }, [portId])

  const currentHour = new Date().getHours()
  const todayDow = new Date().getDay()
  const todayDayName = es ? DAY_NAMES_ES[todayDow] : DAY_NAMES_EN[todayDow]
  const sat = nextSaturday()
  const isFridayOrSaturday = todayDow === 5 || todayDow === 6
  const satLabel = isFridayOrSaturday
    ? (es ? 'Próximo sábado' : 'Next Saturday')
    : (es ? 'Este sábado' : 'This Saturday')

  const moments = useMemo<Moment[]>(() => {
    const list: Moment[] = []

    // Card: today's typical pattern
    if (todayHours && todayHours.some(h => (h.todayAvg ?? h.avgWait) != null)) {
      list.push({
        key: 'today_pattern',
        label: es ? `Patrón típico · ${todayDayName.toLowerCase()}` : `Typical · ${todayDayName}`,
        badge: todayBest && todayPeak
          ? (es ? `mejor ${fmtHour(todayBest.hour, true)} · pico ${fmtHour(todayPeak.hour, true)}` : `best ${fmtHour(todayBest.hour, false)} · peak ${fmtHour(todayPeak.hour, false)}`)
          : null,
        body: <HourlyBars hours={todayHours} highlightHour={currentHour} liveMin={liveMin} />,
      })
    }

    // Card: 6h forecast + delta
    if (forecast6h != null && liveMin != null) {
      const diff = forecast6h - liveMin
      const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
      const trend = diff > 0
        ? (es ? 'Subiendo' : 'Trending up')
        : diff < 0
          ? (es ? 'Bajando' : 'Trending down')
          : (es ? 'Estable' : 'Holding steady')
      list.push({
        key: 'forecast_6h',
        label: es ? 'En 6 horas' : 'In 6 hours',
        badge: trend,
        body: (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-black font-display tabular-nums leading-none">
                {forecast6h}<span className="text-xl opacity-70 ml-1">min</span>
              </p>
              <p className="text-[11px] opacity-70 mt-1.5">
                {es ? `Ahorita ${liveMin} min · ${arrow} ${Math.abs(diff)} min` : `Now ${liveMin} min · ${arrow} ${Math.abs(diff)} min`}
              </p>
            </div>
            <div className="text-5xl opacity-40">{arrow}</div>
          </div>
        ),
      })
    }

    // Card: this/next Saturday
    if (satHours && satHours.some(h => (h.todayAvg ?? h.avgWait) != null)) {
      const sameHour = satHours.find(h => h.hour === currentHour)
      const sameHourValue = sameHour?.todayAvg ?? sameHour?.avgWait ?? null
      list.push({
        key: 'saturday',
        label: satLabel,
        badge: sameHourValue != null
          ? (es ? `${fmtHour(currentHour, true)}: ~${sameHourValue} min` : `${fmtHour(currentHour, false)}: ~${sameHourValue} min`)
          : (sat.toLocaleDateString(es ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' })),
        body: <HourlyBars hours={satHours} highlightHour={currentHour} liveMin={liveMin} />,
      })
    }

    return list
  }, [todayHours, todayBest, todayPeak, forecast6h, satHours, liveMin, currentHour, todayDayName, satLabel, es])

  useEffect(() => {
    if (moments.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % moments.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [moments.length])

  if (moments.length === 0) return null

  const current = moments[idx % moments.length]

  return (
    <div className="mt-3 mb-4">
      <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 px-4 py-3.5 overflow-hidden text-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-gray-500 dark:text-gray-400">
            {current.label}
          </p>
          {current.badge && (
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate max-w-[55%] tabular-nums">
              {current.badge}
            </span>
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {current.body}
          </motion.div>
        </AnimatePresence>
        {moments.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {moments.map((m, i) => (
              <button
                key={m.key}
                onClick={() => setIdx(i)}
                aria-label={m.label}
                className={`rounded-full transition-all ${
                  i === idx
                    ? 'bg-blue-600 dark:bg-blue-400 w-6 h-1.5'
                    : 'bg-gray-300 dark:bg-gray-600 w-1.5 h-1.5'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
