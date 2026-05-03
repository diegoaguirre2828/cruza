'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { useLang } from '@/lib/LangContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { tapSelection, tapLight } from '@/lib/haptics'

interface Props {
  portId: string
  port: {
    vehicle: number | null
    sentri: number | null
    pedestrian: number | null
    commercial: number | null
    recordedAt?: string | null
    portName: string
  }
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

const ROTATE_MS = 6000
const SWIPE_THRESHOLD = 50
const SWIPE_VELOCITY = 250
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
    () => hours.reduce((m, h) => {
      const v = h.todayAvg ?? h.avgWait
      return v != null && v > m ? v : m
    }, 0),
    [hours],
  )
  const focus = hovered ?? highlightHour ?? null
  const focusBucket = focus != null ? hours.find(h => h.hour === focus) : null
  const focusValue = focusBucket?.todayAvg ?? focusBucket?.avgWait ?? null

  return (
    <div className="w-full">
      <div className="flex items-end gap-[3px] h-[88px] mt-1">
        {hours.map((h) => {
          const v = h.todayAvg ?? h.avgWait ?? null
          const heightPct = v != null && maxWait > 0 ? Math.max(8, Math.round((v / maxWait) * 100)) : 6
          const isFocus = h.hour === focus
          return (
            <button
              key={h.hour}
              type="button"
              onClick={(e) => { e.stopPropagation(); setHovered(h.hour); tapSelection() }}
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

// PRIMARY hero — rotating, swipeable, double-tap to /advanced.
// Replaces both the prior PortDetailHero and CrossingVerdict per Diego
// 2026-05-02: "swap the data hero with the actual wait time hero" +
// "data hero can be swiped... double tap... takes them to deep stats."
//
// Cards (in order): Now (live wait + verdict) → Today's pattern →
// In 6 hours → This/Next Saturday. Auto-advances every 6s, pauses
// 8s after manual interaction. Swipe left/right to flip cards. Double-
// tap anywhere on the card body to navigate to /port/[id]/advanced.

export function BridgeMomentChips({ portId, port }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const router = useRouter()

  const liveMin = port.vehicle ?? null

  const [todayHours, setTodayHours] = useState<HourBucket[] | null>(null)
  const [todayBest, setTodayBest] = useState<{ hour: number; avgWait: number } | null>(null)
  const [todayPeak, setTodayPeak] = useState<{ hour: number; avgWait: number } | null>(null)
  const [satHours, setSatHours] = useState<HourBucket[] | null>(null)
  const [forecast6h, setForecast6h] = useState<number | null>(null)

  const [idx, setIdx] = useState(0)
  const [autoPaused, setAutoPaused] = useState(false)
  const pauseTimer = useRef<number | null>(null)
  const lastTapRef = useRef<number>(0)

  function pauseAutoRotate(ms = 8000) {
    setAutoPaused(true)
    if (pauseTimer.current != null) window.clearTimeout(pauseTimer.current)
    pauseTimer.current = window.setTimeout(() => setAutoPaused(false), ms)
  }

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

  // Saturday pattern
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
  const isFridayOrSaturday = todayDow === 5 || todayDow === 6
  const satLabel = isFridayOrSaturday
    ? (es ? 'Próximo sábado' : 'Next Saturday')
    : (es ? 'Este sábado' : 'This Saturday')

  // Verdict for the Now card — comparison vs typical at this hour
  const verdict = useMemo(() => {
    if (liveMin == null || !todayHours) return null
    const sameHour = todayHours.find(h => h.hour === currentHour)
    const typical = sameHour?.todayAvg ?? sameHour?.avgWait ?? null
    if (typical == null) return null
    const diff = liveMin - typical
    if (Math.abs(diff) <= 5) return { tone: 'neutral', text: es ? 'Como un día normal' : 'About average' }
    if (diff < 0) return { tone: 'good', text: es ? `${Math.abs(diff)} min mejor que lo típico` : `${Math.abs(diff)} min better than typical` }
    return { tone: 'bad', text: es ? `${diff} min más lento que lo típico` : `${diff} min slower than typical` }
  }, [liveMin, todayHours, currentHour, es])

  const updatedAgo = useMemo(() => {
    if (!port.recordedAt) return null
    const ms = Date.now() - new Date(port.recordedAt).getTime()
    const min = Math.max(0, Math.round(ms / 60000))
    if (min < 1) return es ? 'ahora' : 'just now'
    if (min === 1) return es ? '1 min' : '1 min ago'
    return es ? `${min} min` : `${min} min ago`
  }, [port.recordedAt, es])

  const moments = useMemo<Moment[]>(() => {
    const list: Moment[] = []

    // Card 1: Now (the actual live wait — replaces the old PortDetailHero)
    list.push({
      key: 'now',
      label: es ? 'Ahora' : 'Right now',
      badge: updatedAgo ? (es ? `actualizado ${updatedAgo}` : `updated ${updatedAgo}`) : 'CBP',
      body: (
        <div>
          <div className="flex items-end gap-3 mb-1">
            <p className="text-[64px] leading-none font-black font-display tabular-nums">
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
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {([
              { lane: es ? 'SENTRI' : 'SENTRI', value: port.sentri },
              { lane: es ? 'Auto' : 'Car', value: port.vehicle },
              { lane: es ? 'A pie' : 'Walk', value: port.pedestrian },
              { lane: es ? 'Camión' : 'Truck', value: port.commercial },
            ]).map((l) => (
              <div
                key={l.lane}
                className="rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1.5 text-center"
              >
                <p className="text-[9px] uppercase tracking-wider opacity-60 font-bold">{l.lane}</p>
                <p className="text-[13px] font-black tabular-nums mt-0.5">
                  {l.value != null ? `${l.value}m` : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ),
    })

    // Card 2: Today's typical pattern
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

    // Card 3: 6h forecast
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
          <div className="flex items-end justify-between gap-3 py-2">
            <div>
              <p className="text-5xl font-black font-display tabular-nums leading-none">
                {forecast6h}<span className="text-xl opacity-70 ml-1">min</span>
              </p>
              <p className="text-xs opacity-70 mt-2">
                {es ? `Ahorita ${liveMin} min · ${arrow} ${Math.abs(diff)} min` : `Now ${liveMin} min · ${arrow} ${Math.abs(diff)} min`}
              </p>
            </div>
            <div className="text-6xl opacity-40 leading-none">{arrow}</div>
          </div>
        ),
      })
    }

    // Card 4: This/Next Saturday
    if (satHours && satHours.some(h => (h.todayAvg ?? h.avgWait) != null)) {
      const sameHour = satHours.find(h => h.hour === currentHour)
      const sameHourValue = sameHour?.todayAvg ?? sameHour?.avgWait ?? null
      list.push({
        key: 'saturday',
        label: satLabel,
        badge: sameHourValue != null
          ? (es ? `${fmtHour(currentHour, true)}: ~${sameHourValue} min` : `${fmtHour(currentHour, false)}: ~${sameHourValue} min`)
          : null,
        body: <HourlyBars hours={satHours} highlightHour={currentHour} liveMin={liveMin} />,
      })
    }

    return list
  }, [liveMin, port.sentri, port.pedestrian, port.commercial, port.vehicle, todayHours, todayBest, todayPeak, forecast6h, satHours, verdict, updatedAgo, todayDayName, satLabel, currentHour, es])

  useEffect(() => {
    if (moments.length <= 1 || autoPaused) return
    const t = setInterval(() => setIdx(i => (i + 1) % moments.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [moments.length, autoPaused])

  function goTo(next: number) {
    pauseAutoRotate()
    tapSelection()
    setIdx(((next % moments.length) + moments.length) % moments.length)
  }

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const offset = info.offset.x
    const velocity = info.velocity.x
    if (offset > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY) {
      goTo(idx - 1)
    } else if (offset < -SWIPE_THRESHOLD || velocity < -SWIPE_VELOCITY) {
      goTo(idx + 1)
    }
  }

  function handleClick() {
    const now = Date.now()
    if (now - lastTapRef.current < 320) {
      tapLight()
      router.push(`/port/${encodeURIComponent(portId)}/advanced`)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  if (moments.length === 0) return null

  const current = moments[idx % moments.length]

  return (
    <div className="mt-2 mb-4 select-none">
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        whileTap={{ scale: 0.995 }}
        className="relative rounded-3xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 px-5 py-5 overflow-hidden text-gray-900 dark:text-gray-100 shadow-sm cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center justify-between mb-3">
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
            transition={{ duration: 0.22 }}
          >
            {current.body}
          </motion.div>
        </AnimatePresence>
        <p className="mt-3 text-[10px] text-center text-gray-400 dark:text-gray-500 leading-tight">
          {es ? 'Desliza · doble-toca pa\' datos profundos' : 'Swipe · double-tap for deep stats'}
        </p>
      </motion.div>
      {moments.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {moments.map((m, i) => (
            <button
              key={m.key}
              onClick={(e) => { e.stopPropagation(); goTo(i) }}
              aria-label={m.label}
              className={`rounded-full transition-all ${
                i === idx
                  ? 'bg-blue-600 dark:bg-blue-400 w-7 h-1.5'
                  : 'bg-gray-300 dark:bg-gray-600 w-1.5 h-1.5'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
