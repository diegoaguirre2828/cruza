'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { PlannerCTACard } from './PlannerCTACard'

// Tier 1 personalization — shows the signed-in user rolled-up
// insights about their own crossing habits. Visible only after
// they've filed 3+ reports (otherwise there's nothing to learn
// from yet). Consumes /api/user/crossing-profile.
//
// Content:
//   1. "You usually cross [port] around [hour]" — the anchor fact
//   2. "Your typical wait: X min vs public avg: Y min" — with a
//      delta arrow (green if theirs is shorter, red if longer)
//   3. Top 3 most-crossed ports as tappable chips
//
// Hidden entirely when totalReports < 3. This is the reward for
// being an active reporter — power users see their own patterns
// reflected back.

interface Profile {
  totalReports: number
  mostFrequentPortId: string | null
  mostFrequentPortCity: string | null
  mostFrequentDow: number | null
  mostFrequentHourLabel: string | null
  avgWaitReported: number | null
  publicAvgWait: number | null
  typicalTripPurpose: string | null
  topPorts: Array<{ portId: string; city: string | null; count: number }>
}

const DOW_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DOW_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const TRIP_LABEL: Record<string, { es: string; en: string }> = {
  commute:    { es: 'al trabajo', en: 'for work' },
  leisure:    { es: 'de paseo',   en: 'for leisure' },
  commercial: { es: 'comercial',  en: 'commercial' },
  medical:    { es: 'al doctor',  en: 'for medical' },
  shopping:   { es: 'de compras', en: 'for shopping' },
  family:     { es: 'de familia', en: 'for family' },
  other:      { es: 'por otra razón', en: 'for another reason' },
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Returns the next Date matching (dayOfWeek, hour) from now. If today is
// the target day but the hour has already passed, jumps to next week.
function nextPatternMatch(dow: number, hour: number, minute = 0): Date {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)
  const dayDiff = (dow - now.getDay() + 7) % 7
  if (dayDiff === 0 && target.getTime() <= now.getTime()) {
    target.setDate(now.getDate() + 7)
  } else {
    target.setDate(now.getDate() + dayDiff)
  }
  return target
}

function formatNextDate(d: Date, es: boolean): string {
  const dowName = es ? DOW_ES[d.getDay()] : DOW_EN[d.getDay()]
  const monthName = es ? MONTHS_ES[d.getMonth()] : MONTHS_EN[d.getMonth()]
  const day = d.getDate()
  const hh = d.getHours()
  const mm = d.getMinutes()
  const period = hh >= 12 ? 'PM' : 'AM'
  const hh12 = hh % 12 === 0 ? 12 : hh % 12
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(dowName)} · ${monthName} ${day} · ${hh12}:${mm.toString().padStart(2, '0')} ${period}`
}

export function UserCrossingInsights() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [predictedWait, setPredictedWait] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/user/crossing-profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  // Parse the user's pattern hour once (used for both prediction fetch
  // and the next-crossing date math).
  const patternHour = (() => {
    if (!profile?.mostFrequentHourLabel) return null
    const start = profile.mostFrequentHourLabel.split('-')[0]
    const h = parseInt(start.split(':')[0], 10)
    return Number.isNaN(h) ? null : h
  })()

  useEffect(() => {
    if (
      !profile?.mostFrequentPortId ||
      profile.mostFrequentDow == null ||
      patternHour == null
    ) return
    const portId = profile.mostFrequentPortId
    const dow = profile.mostFrequentDow
    const hour = patternHour
    fetch(`/api/predict?portIds=${encodeURIComponent(portId)}&day=${dow}&hour=${hour}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.results) return
        const portResults = d.results[portId]
        const match = portResults?.dayAverages?.find(
          (a: { day: number; hour: number; vehicleAvg: number | null }) =>
            a.day === dow && a.hour === hour
        )
        if (match?.vehicleAvg != null) setPredictedWait(match.vehicleAvg)
      })
      .catch(() => { /* prediction is optional — silent */ })
  }, [profile?.mostFrequentPortId, profile?.mostFrequentDow, patternHour])

  if (loading) return null
  // No profile or not enough data to surface a pattern — fall back to
  // the manual planner CTA so the user still has a path to the
  // scheduling experience without hopping pages.
  if (!profile || profile.totalReports < 3) return <PlannerCTACard />

  const hasAnchor = profile.mostFrequentPortCity && profile.mostFrequentHourLabel
  const hasWaitCompare = profile.avgWaitReported != null && profile.publicAvgWait != null

  // Compute the wait delta — your wait minus public average. Negative
  // means you're lucky (shorter than average); positive means unlucky
  // or you always pick rough hours.
  const waitDelta = hasWaitCompare
    ? (profile.avgWaitReported as number) - (profile.publicAvgWait as number)
    : null

  const deltaSign = waitDelta == null ? 'flat' : waitDelta < -3 ? 'better' : waitDelta > 3 ? 'worse' : 'flat'

  return (
    <div className="mt-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 rounded-3xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
          {es ? 'Tu patrón de cruces' : 'Your crossing pattern'}
        </p>
        <span className="ml-auto text-[10px] text-indigo-500 dark:text-indigo-400 font-bold tabular-nums">
          {profile.totalReports} {es ? 'reportes' : 'reports'}
        </span>
      </div>

      {/* Anchor fact — "you usually cross Hidalgo around 6am on Fridays" */}
      {hasAnchor && (
        <p className="text-sm text-gray-900 dark:text-gray-100 leading-snug mb-2">
          {es ? 'Normalmente cruzas ' : 'You usually cross '}
          <span className="font-black">{profile.mostFrequentPortCity}</span>
          {profile.mostFrequentHourLabel && (
            <>
              {es ? ' alrededor de las ' : ' around '}
              <span className="font-black">{profile.mostFrequentHourLabel?.split('-')[0]}</span>
            </>
          )}
          {profile.mostFrequentDow != null && (
            <>
              {es ? ' los ' : ' on '}
              <span className="font-black">
                {es ? DOW_ES[profile.mostFrequentDow] : DOW_EN[profile.mostFrequentDow]}
                {es ? 's' : 's'}
              </span>
            </>
          )}
          {profile.typicalTripPurpose && TRIP_LABEL[profile.typicalTripPurpose] && (
            <>
              , {es ? 'usualmente ' : 'usually '}
              <span className="font-black">
                {es ? TRIP_LABEL[profile.typicalTripPurpose].es : TRIP_LABEL[profile.typicalTripPurpose].en}
              </span>
            </>
          )}
          .
        </p>
      )}

      {/* Wait comparison */}
      {hasWaitCompare && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {es ? 'Tu espera típica' : 'Your typical wait'}
            </p>
            <p className="text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
              {profile.avgWaitReported}<span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">min</span>
            </p>
          </div>
          <div className="flex flex-col items-center">
            {deltaSign === 'better' && <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400" />}
            {deltaSign === 'worse' && <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />}
            {deltaSign === 'flat' && <Minus className="w-5 h-5 text-gray-400" />}
            <span
              className={`text-[10px] font-black tabular-nums ${
                deltaSign === 'better'
                  ? 'text-green-600 dark:text-green-400'
                  : deltaSign === 'worse'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-400'
              }`}
            >
              {waitDelta != null && waitDelta !== 0 && (waitDelta > 0 ? '+' : '')}
              {waitDelta ?? 0}m
            </span>
          </div>
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {es ? 'Promedio público' : 'Public average'}
            </p>
            <p className="text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
              {profile.publicAvgWait}<span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">min</span>
            </p>
          </div>
        </div>
      )}

      {/* "Better/worse than average" tagline */}
      {hasWaitCompare && deltaSign !== 'flat' && (
        <p className={`mt-2 text-[11px] leading-snug text-center ${
          deltaSign === 'better'
            ? 'text-green-700 dark:text-green-400 font-semibold'
            : 'text-red-700 dark:text-red-400 font-semibold'
        }`}>
          {deltaSign === 'better'
            ? (es ? `Cruzas ${Math.abs(waitDelta as number)} min más rápido que el promedio. Bien hecho.` : `You cross ${Math.abs(waitDelta as number)} min faster than average. Nice.`)
            : (es ? `Cruzas ${Math.abs(waitDelta as number)} min más lento que el promedio. ¿Prueba otra hora?` : `You cross ${Math.abs(waitDelta as number)} min slower than average. Try a different hour?`)}
        </p>
      )}

      {/* Top crossed ports as tappable chips */}
      {profile.topPorts.length > 1 && (
        <div className="mt-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1.5">
            {es ? 'Tus puentes más cruzados' : 'Your most-crossed bridges'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.topPorts.map((p) => (
              <Link
                key={p.portId}
                href={`/port/${encodeURIComponent(p.portId)}`}
                className="inline-flex items-center gap-1 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 rounded-full px-2.5 py-1 text-[11px] font-bold text-indigo-800 dark:text-indigo-200 hover:border-indigo-400 active:scale-95 transition-transform"
              >
                {p.city || p.portId}
                <span className="text-indigo-500 dark:text-indigo-400 font-black tabular-nums text-[10px]">
                  ×{p.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* NEXT CROSSING — fuses the pattern card with the planner so
          users don't hop to /planner just to re-enter their habit.
          Surfaces the next instance of (dow + hour) and, if available,
          the historical-average wait at that moment. Deep-links to
          /planner with day + hour pre-filled for "different time"
          drilldown. */}
      {profile.mostFrequentDow != null && patternHour != null && hasAnchor && (() => {
        const next = nextPatternMatch(profile.mostFrequentDow, patternHour)
        return (
          <div className="mt-4 pt-3 border-t border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                {es ? 'Próximo cruce' : 'Next crossing'}
              </p>
              <Link
                href={`/planner?day=${profile.mostFrequentDow}&hour=${patternHour}`}
                className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
              >
                {es ? 'Otra hora →' : 'Different time →'}
              </Link>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatNextDate(next, es)}
            </p>
            {predictedWait != null ? (
              <p className="text-[12px] text-gray-700 dark:text-gray-300 mt-0.5 leading-snug">
                {es
                  ? `Espera estimada en ${profile.mostFrequentPortCity}: `
                  : `Predicted wait at ${profile.mostFrequentPortCity}: `}
                <span className="font-black tabular-nums">~{predictedWait} min</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug italic">
                {es
                  ? `Sin suficientes datos históricos para predecir aún.`
                  : `Not enough historical data to predict yet.`}
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}
