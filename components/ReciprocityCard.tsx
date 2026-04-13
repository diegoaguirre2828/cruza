'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { getPortMeta } from '@/lib/portMeta'

// Home-page reciprocity card. Signed-in users with at least one
// saved crossing see a "someone just reported your bridge" pill
// when fresh activity lands on a port they care about. Frames the
// sighting as a debt-to-return, which is how neighborly-favor
// culture works on the border ("alguien te hizo el favor — ahora
// cuando cruces devuélvelo").
//
// Uses /api/user/saved-activity to find recent community reports
// on the user's saved ports. Hides itself if there's no fresh
// activity.

interface Activity {
  port_id: string
  report_type: string
  created_at: string
  username: string | null
  wait_minutes: number | null
}

const TYPE_EMOJI: Record<string, string> = {
  delay: '🔴', inspection: '🔵', accident: '💥', clear: '🟢', other: '💬',
  weather_fog: '🌫️', weather_rain: '🌧️', weather_wind: '💨',
  officer_k9: '🐕', officer_secondary: '🚔',
  road_construction: '🚧', road_hazard: '⚠️',
}

function ageMin(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

export function ReciprocityCard() {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [activity, setActivity] = useState<Activity[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = () => {
      fetch('/api/user/saved-activity')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (cancelled) return
          setActivity(d?.activity || [])
        })
        .catch(() => { /* silent */ })
    }
    load()
    const tick = setInterval(load, 90_000)
    return () => { cancelled = true; clearInterval(tick) }
  }, [user])

  if (!user || activity.length === 0) return null

  // Pick the single freshest report across all saved ports.
  const latest = activity[0]
  const meta = getPortMeta(latest.port_id)
  const portName = meta.localName || meta.city || latest.port_id
  const name = latest.username || (es ? 'Alguien' : 'Someone')
  const mins = ageMin(latest.created_at)
  const emoji = TYPE_EMOJI[latest.report_type] || '📣'

  return (
    <Link
      href={`/port/${encodeURIComponent(latest.port_id)}`}
      className="mt-3 block bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl px-4 py-3 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none flex-shrink-0">🤝</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest font-black text-amber-700 dark:text-amber-400">
            {es ? 'Alguien te hizo el favor' : 'Someone looked out for you'}
          </p>
          <p className="text-sm font-black text-amber-900 dark:text-amber-100 mt-0.5 leading-tight">
            {es
              ? `${name} reportó ${portName} ${mins < 1 ? 'ahorita' : `hace ${mins} min`} ${emoji}`
              : `${name} reported ${portName} ${mins < 1 ? 'just now' : `${mins} min ago`} ${emoji}`}
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 font-semibold leading-snug">
            {es
              ? 'Devuelve el favor: reporta tú cuando cruces.'
              : 'Return the favor: report back when you cross.'}
          </p>
        </div>
      </div>
    </Link>
  )
}
