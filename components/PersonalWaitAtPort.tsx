'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

interface Trip {
  id: string
  status: string
  started_at: string
  ended_at: string | null
}

interface Props {
  portId: string
  currentVehicleWait: number | null
}

// Personal wait widget on /port/[portId]. Shows the user's average
// crossing duration AT THIS port (computed from their /api/crossings
// records) compared to the current published wait. Hidden until the
// user has 3+ completed crossings at this port — otherwise the average
// is too noisy.
//
// Different from <UserCrossingInsights /> (which shows the user's
// most-frequent port pattern globally on the home page). This one is
// scoped to a single port detail page.
export function PersonalWaitAtPort({ portId, currentVehicleWait }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [avgMin, setAvgMin] = useState<number | null>(null)
  const [tripCount, setTripCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/crossings?port_id=${encodeURIComponent(portId)}&limit=50`)
      .then(r => (r.ok ? r.json() : { crossings: [] }))
      .then(d => {
        if (cancelled) return
        const trips: Trip[] = d.crossings || []
        const completed = trips.filter(t => t.status === 'completed' && t.ended_at)
        if (completed.length === 0) {
          setLoaded(true)
          return
        }
        const total = completed.reduce((sum, t) => {
          const ms = new Date(t.ended_at as string).getTime() - new Date(t.started_at).getTime()
          return sum + Math.round(ms / 60000)
        }, 0)
        setAvgMin(Math.round(total / completed.length))
        setTripCount(completed.length)
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [portId])

  // Hide entirely until 3+ completed trips — small samples are misleading.
  if (!loaded || avgMin == null || tripCount < 3) return null

  const delta = currentVehicleWait != null ? currentVehicleWait - avgMin : null
  const sign: 'better' | 'worse' | 'flat' = delta == null
    ? 'flat'
    : delta < -3 ? 'better' : delta > 3 ? 'worse' : 'flat'

  return (
    <div className="mt-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          {es ? 'Tu promedio aquí' : 'Your average here'}
        </p>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
          {tripCount} {es ? 'cruces' : 'trips'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {es ? 'Tu promedio' : 'Your average'}
          </p>
          <p className="text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
            {avgMin}<span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">min</span>
          </p>
        </div>

        <div className="flex flex-col items-center">
          {sign === 'better' && <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400" />}
          {sign === 'worse' && <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />}
          {sign === 'flat' && <Minus className="w-5 h-5 text-gray-400" />}
          <span className={`text-[10px] font-black tabular-nums ${
            sign === 'better' ? 'text-green-600 dark:text-green-400'
            : sign === 'worse' ? 'text-red-600 dark:text-red-400'
            : 'text-gray-400'
          }`}>
            {delta != null && delta !== 0 && (delta > 0 ? '+' : '')}{delta ?? 0}m
          </span>
        </div>

        <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {es ? 'Ahora' : 'Now'}
          </p>
          <p className="text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
            {currentVehicleWait != null
              ? <>{currentVehicleWait}<span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">min</span></>
              : <span className="text-sm text-gray-400">—</span>}
          </p>
        </div>
      </div>

      {sign !== 'flat' && delta != null && (
        <p className={`mt-2 text-[11px] leading-snug text-center ${
          sign === 'better' ? 'text-green-700 dark:text-green-400 font-semibold'
          : 'text-red-700 dark:text-red-400 font-semibold'
        }`}>
          {sign === 'better'
            ? (es
                ? `La fila está ${Math.abs(delta)} min más rápida que tu promedio. Buen momento.`
                : `The line is ${Math.abs(delta)} min faster than your average. Good time to go.`)
            : (es
                ? `La fila está ${Math.abs(delta)} min más lenta que tu promedio. ¿Esperas?`
                : `The line is ${Math.abs(delta)} min slower than your average. Wait it out?`)}
        </p>
      )}
    </div>
  )
}
