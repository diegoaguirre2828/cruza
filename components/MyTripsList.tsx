'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'

interface Trip {
  id: string
  port_id: string
  direction: 'us_to_mx' | 'mx_to_us'
  status: 'planning' | 'en_route' | 'in_line' | 'crossing' | 'completed' | 'abandoned'
  modules_present: string[]
  started_at: string
  ended_at: string | null
}

const STATUS_LABEL: Record<string, { es: string; en: string }> = {
  planning: { es: 'Planeando', en: 'Planning' },
  en_route: { es: 'En camino', en: 'En route' },
  in_line: { es: 'En fila', en: 'In line' },
  crossing: { es: 'Cruzando', en: 'Crossing' },
  completed: { es: 'Completado', en: 'Completed' },
  abandoned: { es: 'Cancelado', en: 'Cancelled' },
}

function durationMinutes(t: Trip): number | null {
  if (!t.ended_at) return null
  return Math.round((new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 60000)
}

export function MyTripsList() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/crossings?limit=20')
      .then(r => (r.ok ? r.json() : { crossings: [] }))
      .then(d => { if (!cancelled) setTrips(d.crossings || []) })
      .catch(() => { if (!cancelled) setTrips([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  if (trips.length === 0) return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
        {es ? 'Aún no tienes cruces registrados' : 'No crossings yet'}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {es
          ? 'Cuando cruces un puente con la app abierta, lo registramos aquí.'
          : 'Open the app while crossing and we\'ll record the trip here.'}
      </p>
    </div>
  )

  return (
    <div className="space-y-3">
      {trips.map(t => {
        const meta = getPortMeta(t.port_id)
        const portName = meta.localName || meta.city || t.port_id
        const dur = durationMinutes(t)
        const started = new Date(t.started_at)
        const dateLabel = started.toLocaleDateString(es ? 'es-MX' : 'en-US', {
          month: 'short', day: 'numeric',
        })
        const timeLabel = started.toLocaleTimeString(es ? 'es-MX' : 'en-US', {
          hour: 'numeric', minute: '2-digit',
        })
        const statusLabel = STATUS_LABEL[t.status]
          ? (es ? STATUS_LABEL[t.status].es : STATUS_LABEL[t.status].en)
          : t.status
        const isActive = t.status !== 'completed' && t.status !== 'abandoned'
        const dirArrow = t.direction === 'us_to_mx' ? 'US → MX' : 'MX → US'

        return (
          <Link
            key={t.id}
            href={`/crossing/${t.id}`}
            className="block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{portName}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{dirArrow}</p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{dateLabel} · {timeLabel}</span>
              <span className="font-mono tabular-nums">
                {dur != null
                  ? `${dur} min`
                  : (es ? 'En curso' : 'In progress')}
              </span>
            </div>
            {t.modules_present.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.modules_present.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
