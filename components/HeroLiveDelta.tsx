'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { getPortMeta, type MegaRegion } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

// The hero moment.
//
// Psychology: land on the page → see ONE huge number (the fastest bridge
// right now) + the loss number (what you'd lose going to the slowest). That
// single comparison IS the elevator pitch of the app: "we just did the
// 10 minutes of scrolling 10 FB posts for you." Hooks stacked here:
//   • Anchoring — giant number defines value instantly
//   • Loss aversion — "pierdes X min si vas al puente equivocado"
//   • Live urgency — pulsing EN VIVO badge + "actualizado hace N seg"
//   • Social proof — "N cruzantes han reportado hoy"
//   • Reciprocity — the share button frames sending it to friends as "help them"
//
// Shareable by design: the snapshot is the post. A screenshot of this
// card IS a viral asset.

const MEGA_REGION_LABEL: Record<MegaRegion, { es: string; en: string }> = {
  rgv:           { es: 'Valle de Texas',                en: 'Rio Grande Valley' },
  laredo:        { es: 'Laredo / Nuevo Laredo',          en: 'Laredo' },
  'coahuila-tx': { es: 'Piedras Negras / Cd. Acuña',     en: 'Coahuila — Texas' },
  'el-paso':     { es: 'Cd. Juárez / El Paso',           en: 'El Paso' },
  'sonora-az':   { es: 'Sonora / Arizona',               en: 'Sonora / Arizona' },
  baja:          { es: 'Baja California',                en: 'Baja California' },
  other:         { es: 'Frontera',                       en: 'Border' },
}

interface Props {
  ports?: PortWaitTime[] | null
}

export function HeroLiveDelta({ ports: propPorts }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [ports, setPorts] = useState<PortWaitTime[] | null>(propPorts ?? null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [region, setRegion] = useState<MegaRegion>('rgv')
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [reportCount, setReportCount] = useState<number | null>(null)

  // Detect preferred mega region from localStorage or last-viewed port
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const override = localStorage.getItem('cruzar_mega_region') as MegaRegion | null
      if (override) { setRegion(override); return }
      const lastPort = localStorage.getItem('cruzar_last_port')
      if (lastPort) {
        const meta = getPortMeta(lastPort)
        if (meta.megaRegion && meta.megaRegion !== 'other') setRegion(meta.megaRegion)
      }
    } catch { /* ignore */ }
  }, [])

  // Fetch ports if not provided
  useEffect(() => {
    if (propPorts) {
      setPorts(propPorts)
      setFetchedAt(new Date())
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/ports', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setPorts(data.ports || [])
          setFetchedAt(new Date())
        }
      } catch { /* ignore */ }
    }
    load()
    const interval = setInterval(load, 60000) // refresh every minute
    return () => { cancelled = true; clearInterval(interval) }
  }, [propPorts])

  // Tick the "hace N seg" label
  useEffect(() => {
    if (!fetchedAt) return
    const tick = () => setSecondsAgo(Math.floor((Date.now() - fetchedAt.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fetchedAt])

  // Load today's report count for social proof
  useEffect(() => {
    fetch('/api/reports/recent?limit=100')
      .then((r) => r.json())
      .then((d) => {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const count = (d.reports || []).filter((r: { created_at: string }) => new Date(r.created_at) >= todayStart).length
        setReportCount(count)
      })
      .catch(() => {})
  }, [])

  if (!ports) return <HeroSkeleton />

  // Filter to the user's mega region
  const regionPorts = ports.filter((p) => getPortMeta(p.portId).megaRegion === region)
  const openPorts = regionPorts.filter(
    (p) => !p.isClosed && p.vehicle !== null && p.vehicle !== undefined,
  )

  if (openPorts.length < 2) {
    // Fall back to a generic hero if we don't have enough data to compare
    return (
      <div className="mt-3 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-5 shadow-2xl text-white">
        <LivePulse es={es} secondsAgo={secondsAgo} />
        <p className="text-2xl font-black mt-3 leading-tight">
          {es ? 'Los tiempos de espera en vivo de todos los puentes.' : 'Live wait times for every crossing.'}
        </p>
        <p className="text-sm text-blue-100 mt-2">
          {es
            ? `En ${MEGA_REGION_LABEL[region].es} · toca un puente abajo para más info`
            : `In ${MEGA_REGION_LABEL[region].en} · tap a crossing below for details`}
        </p>
      </div>
    )
  }

  const sorted = [...openPorts].sort((a, b) => (a.vehicle as number) - (b.vehicle as number))
  const fastest = sorted[0]
  const slowest = sorted[sorted.length - 1]
  const fastestWait = fastest.vehicle as number
  const slowestWait = slowest.vehicle as number
  const delta = slowestWait - fastestWait
  const fastestMeta = getPortMeta(fastest.portId)
  const slowestMeta = getPortMeta(slowest.portId)

  const fastestName = fastestMeta.localName || fastest.crossingName || fastest.portName
  const slowestName = slowestMeta.localName || slowest.crossingName || slowest.portName

  const waitLabel = (n: number) =>
    n === 0 ? (es ? '<1 min' : '<1 min') : `${n} min`

  // Composed WhatsApp share text — the hero snapshot as a message
  const shareText = es
    ? `🌉 Puentes ahorita en ${MEGA_REGION_LABEL[region].es}:\n\n` +
      `⚡ Más rápido: ${fastestName} — ${waitLabel(fastestWait)}\n` +
      `🐢 Más lento: ${slowestName} — ${waitLabel(slowestWait)}\n` +
      (delta > 0 ? `\n💡 Te ahorras ${delta} min si vas al correcto.\n\n` : '\n') +
      `Cruzar.app — gratis, en vivo`
    : `🌉 Crossings right now in ${MEGA_REGION_LABEL[region].en}:\n\n` +
      `⚡ Fastest: ${fastestName} — ${waitLabel(fastestWait)}\n` +
      `🐢 Slowest: ${slowestName} — ${waitLabel(slowestWait)}\n` +
      (delta > 0 ? `\n💡 Save ${delta} min if you pick the right one.\n\n` : '\n') +
      `Cruzar.app — free, live`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  return (
    <div className="mt-3 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden">
      {/* background flair */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-purple-400/20 rounded-full blur-3xl" />

      <div className="relative">
        <LivePulse es={es} secondsAgo={secondsAgo} regionLabel={es ? MEGA_REGION_LABEL[region].es : MEGA_REGION_LABEL[region].en} />

        {/* The big number */}
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-widest font-bold text-blue-100">
            {es ? 'Cruce más rápido ahorita' : 'Fastest crossing right now'}
          </p>
          <p className="mt-1 text-4xl sm:text-5xl font-black leading-none">
            {fastestName}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl sm:text-7xl font-black leading-none text-white drop-shadow">
              {fastestWait === 0 ? '<1' : fastestWait}
            </span>
            <span className="text-xl font-bold text-blue-100">min</span>
          </div>
        </div>

        {/* The loss delta */}
        {delta > 0 && (
          <div className="mt-4 bg-red-500/20 border border-red-300/40 rounded-2xl px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-bold text-red-100 uppercase tracking-wide">
              {es ? 'Lo que pierdes si vas al equivocado' : "What you lose if you pick wrong"}
            </p>
            <p className="text-2xl font-black text-white mt-1">
              {es ? `+${delta} min` : `+${delta} min`}
            </p>
            <p className="text-[11px] text-red-100 mt-0.5">
              {es
                ? `${slowestName} está en ${waitLabel(slowestWait)} ahorita`
                : `${slowestName} is at ${waitLabel(slowestWait)} right now`}
            </p>
          </div>
        )}

        {/* Social proof + share */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-blue-100 font-medium">
            {reportCount != null && reportCount > 0
              ? (es ? `📣 ${reportCount} reportes de la comunidad hoy` : `📣 ${reportCount} community reports today`)
              : (es ? '📣 Sé el primero en reportar hoy' : '📣 Be the first to report today')}
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white text-indigo-700 font-bold text-xs px-4 py-2.5 rounded-full hover:bg-gray-100 active:scale-95 transition-all shadow-lg whitespace-nowrap"
          >
            📲 {es ? 'Compartir' : 'Share'}
          </a>
        </div>
      </div>
    </div>
  )
}

function LivePulse({ es, secondsAgo, regionLabel }: { es: boolean; secondsAgo: number; regionLabel?: string }) {
  const label = secondsAgo < 10
    ? (es ? 'ahora' : 'now')
    : secondsAgo < 60
      ? (es ? `hace ${secondsAgo}s` : `${secondsAgo}s ago`)
      : (es ? `hace ${Math.floor(secondsAgo / 60)} min` : `${Math.floor(secondsAgo / 60)} min ago`)
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-[10px] uppercase font-bold tracking-widest text-white/90">
        {es ? 'EN VIVO' : 'LIVE'}
      </span>
      <span className="text-[10px] text-white/60">· {label}</span>
      {regionLabel && <span className="text-[10px] text-white/60">· {regionLabel}</span>}
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div className="mt-3 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-5 shadow-2xl text-white animate-pulse">
      <div className="h-3 w-24 bg-white/30 rounded-full" />
      <div className="h-8 w-56 bg-white/30 rounded-lg mt-4" />
      <div className="h-20 w-40 bg-white/30 rounded-lg mt-3" />
      <div className="h-14 w-full bg-white/20 rounded-2xl mt-4" />
    </div>
  )
}
