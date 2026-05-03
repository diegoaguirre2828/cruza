'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Navigation, Loader2 } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { trackEvent } from '@/lib/trackEvent'
import { tapLight } from '@/lib/haptics'
import { PORT_META } from '@/lib/portMeta'

interface RouteOption {
  port_id: string
  port_name: string
  wait_min: number
  drive_min: number
  total_min: number
  lat: number
  lng: number
}

// Ambient "smart route" card — auto-shows the fastest crossing right now
// based on the user's location. Replaces the dead /planner CTA (only 2
// fires by 1 user in 30 days per app_events). Lives on the home cerca
// panel where users already look.

export function SmartRouteAmbient() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [state, setState] = useState<'idle' | 'asking' | 'denied' | 'loading' | 'ready' | 'error'>('idle')
  const [options, setOptions] = useState<RouteOption[]>([])
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('error')
      return
    }
    setState('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setState('loading')
      },
      () => setState('denied'),
      { maximumAge: 5 * 60 * 1000, timeout: 6000, enableHighAccuracy: false },
    )
  }, [])

  useEffect(() => {
    if (state !== 'loading' || !coords) return
    fetchWithTimeout(`/api/smart-route?lat=${coords.lat}&lng=${coords.lng}&limit=3`, { cache: 'no-store' }, 6000)
      .then(r => r.ok ? r.json() : { options: [] })
      .then((data: { options?: RouteOption[] }) => {
        const opts = (data.options ?? []).slice(0, 3)
        if (opts.length === 0) {
          setState('error')
        } else {
          setOptions(opts)
          setState('ready')
          trackEvent('smart_route_ambient_loaded', { count: opts.length })
        }
      })
      .catch(() => setState('error'))
  }, [state, coords])

  if (state === 'asking' || state === 'loading') {
    return (
      <div className="mt-2 mb-3 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 px-4 py-3 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
          {es ? 'Buscando el puente más rápido cerca de ti…' : 'Finding the fastest bridge near you…'}
        </p>
      </div>
    )
  }

  if (state === 'denied' || state === 'error' || state === 'idle') return null

  const fastest = options[0]
  const meta = PORT_META[fastest.port_id]
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${meta?.lat ?? fastest.lat},${meta?.lng ?? fastest.lng}&travelmode=driving`
  const localName = meta?.localName || meta?.city || fastest.port_name

  return (
    <div className="mt-2 mb-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-4 shadow-lg shadow-blue-600/20">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-3.5 h-3.5 text-blue-200" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-blue-200 font-bold">
          {es ? 'El más rápido ahorita' : 'Fastest right now'}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-black text-white truncate font-display leading-tight">{localName}</p>
          <p className="text-xs text-blue-100 mt-0.5 tabular-nums">
            <span className="font-bold">{fastest.wait_min}</span> min
            {es ? ' espera' : ' wait'} ·{' '}
            <span className="font-bold">{fastest.drive_min}</span> min
            {es ? ' manejo' : ' drive'}
          </p>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { tapLight(); trackEvent('smart_route_ambient_navigate', { port_id: fastest.port_id }) }}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-blue-700 text-xs font-black shadow-sm active:scale-[0.97] transition-transform"
        >
          <Navigation className="w-3.5 h-3.5" />
          {es ? 'Ir' : 'Go'}
        </a>
      </div>

      {options.length > 1 && (
        <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-2 gap-x-3 gap-y-1">
          {options.slice(1).map(o => {
            const m = PORT_META[o.port_id]
            const name = m?.localName || m?.city || o.port_name
            return (
              <Link
                key={o.port_id}
                href={`/cruzar/${o.port_id}`}
                className="flex items-center justify-between text-[11px] text-blue-100 active:opacity-70"
              >
                <span className="truncate font-semibold">{name}</span>
                <span className="font-mono tabular-nums font-bold ml-2">{o.total_min}m</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
