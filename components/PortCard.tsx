'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Share2, Check, Star, Bell, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { BridgeAlertSheet } from './BridgeAlertSheet'
import { BridgeReportSheet } from './BridgeReportSheet'
import { tapLight, tapSelection, tapSuccess } from '@/lib/haptics'
import { trackEvent } from '@/lib/trackEvent'
import { getWaitLevel, waitLevelDot } from '@/lib/cbp'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'
import { trackShare } from '@/lib/trackShare'
import { getMyRecentReportAgeMin } from '@/lib/myReports'
import { useFavorites } from '@/lib/useFavorites'
import { hasCamera, hasProLiveCamera } from '@/lib/bridgeCameras'
import { slugForPort } from '@/lib/portSlug'
import { SignupIntentModal, type SignupIntent } from './SignupIntentModal'
import type { PortWaitTime } from '@/types'

export interface PortSignal {
  type: 'accident' | 'delay' | 'clear' | 'crossed'
  count?: number
  minutesAgo?: number
  waited?: number
  laneType?: string | null
}

interface Props {
  port: PortWaitTime
  signal?: PortSignal | null
}

// Status-reactive color maps used for accent bar, hero number, and hover glow
const ACCENT_BAR: Record<string, string> = {
  low:     'bg-green-500',
  medium:  'bg-amber-500',
  high:    'bg-red-500',
  closed:  'bg-gray-400',
  unknown: 'bg-gray-400/50',
}
const HERO_NUM: Record<string, string> = {
  low:     'text-green-500 dark:text-green-400',
  medium:  'text-amber-500 dark:text-amber-400',
  high:    'text-red-500 dark:text-red-400',
  closed:  'text-gray-400',
  unknown: 'text-gray-400 dark:text-gray-500',
}
const HOVER_GLOW: Record<string, string> = {
  low:     'dark:hover:border-green-500/25 dark:hover:shadow-[0_0_28px_rgba(34,197,94,0.07)]',
  medium:  'dark:hover:border-amber-500/25 dark:hover:shadow-[0_0_28px_rgba(245,158,11,0.07)]',
  high:    'dark:hover:border-red-500/25 dark:hover:shadow-[0_0_28px_rgba(239,68,68,0.07)]',
  closed:  '',
  unknown: '',
}

export function PortCard({ port, signal }: Props) {
  const { t, lang } = useLang()
  const router = useRouter()
  const { isFavorite, toggleFavorite, signedIn } = useFavorites()
  const starred = isFavorite(port.portId)
  const meta = getPortMeta(port.portId)
  const effectiveLocalName = port.localNameOverride || meta.localName
  const localContainsCrossing = !!effectiveLocalName
    && !!port.crossingName
    && effectiveLocalName.toLowerCase().includes(port.crossingName.toLowerCase())
  const displayCrossing = effectiveLocalName
    ? (localContainsCrossing ? effectiveLocalName : `${port.crossingName} / ${effectiveLocalName}`)
    : port.crossingName
  const allNull = port.vehicle === null && port.pedestrian === null && port.sentri === null && port.commercial === null
  const primaryLevel = getWaitLevel(port.vehicle)
  const dot = port.isClosed ? 'bg-gray-400' : allNull ? 'bg-gray-400' : waitLevelDot(primaryLevel)
  const primaryWait = port.vehicle ?? port.pedestrian
  const [shared, setShared] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showAlertSheet, setShowAlertSheet] = useState(false)
  const [showReportSheet, setShowReportSheet] = useState(false)
  const [signupModalIntent, setSignupModalIntent] = useState<SignupIntent | null>(null)
  const [myReportAge, setMyReportAge] = useState<number | null>(null)
  useEffect(() => {
    const refresh = () => setMyReportAge(getMyRecentReportAgeMin(port.portId))
    refresh()
    const tick = setInterval(refresh, 60_000)
    window.addEventListener('cruzar:my-reports-updated', refresh)
    return () => {
      clearInterval(tick)
      window.removeEventListener('cruzar:my-reports-updated', refresh)
    }
  }, [port.portId])

  const carsAhead = primaryWait !== null && primaryWait > 0
    ? port.vehicleLanesOpen && port.vehicleLanesOpen > 0
      ? Math.round(primaryWait * port.vehicleLanesOpen * 0.7)
      : Math.round(primaryWait * 3)
    : null

  // Status level drives accent bar, hero color, and hover glow
  const statusLevel = port.isClosed ? 'closed' : allNull ? 'unknown' : primaryLevel

  // Lane chip data — compact inline row replacing WaitBadge
  const laneChipItems = [
    (port.vehicle !== null || port.vehicleClosed) && {
      key: 'car', label: t.laneCar, min: port.vehicle,
      isClosed: !!port.vehicleClosed, isSentri: false,
    },
    port.sentri !== null && {
      key: 'sentri', label: 'SENTRI', min: port.sentri,
      isClosed: false, isSentri: true,
    },
    (port.pedestrian !== null || port.pedestrianClosed) && {
      key: 'ped', label: t.laneWalk, min: port.pedestrian,
      isClosed: !!port.pedestrianClosed, isSentri: false,
    },
    (port.commercial !== null || port.commercialClosed) && {
      key: 'com', label: t.laneTruck, min: port.commercial,
      isClosed: !!port.commercialClosed, isSentri: false,
    },
  ].filter(Boolean) as Array<{ key: string; label: string; min: number | null; isClosed: boolean; isSentri: boolean }>

  async function handleStar(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) {
      tapLight()
      setSignupModalIntent('favorite')
      return
    }
    const wasStarred = starred
    tapSelection()
    await toggleFavorite(port.portId, port.portName)
    if (!wasStarred) {
      tapSuccess()
      toast.success(
        lang === 'es' ? `Guardado · ${port.portName}` : `Saved · ${port.portName}`,
        { duration: 2500 }
      )
    }
  }

  function handleAlertBell(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    tapLight()
    if (!signedIn) {
      setSignupModalIntent('alert')
      return
    }
    setShowAlertSheet(true)
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    tapLight()
    trackShare('native', 'port_card')

    const fmt = (n: number) => n === 0 ? '<1 min' : `${n} min`
    const parts: string[] = []
    if (port.vehicle !== null) parts.push(`🚗 ${lang === 'es' ? 'Auto' : 'Car'}: ${fmt(port.vehicle)}`)
    if (port.pedestrian !== null) parts.push(`🚶 ${lang === 'es' ? 'A pie' : 'Walk'}: ${fmt(port.pedestrian)}`)
    if (port.sentri !== null) parts.push(`⚡ SENTRI: ${fmt(port.sentri)}`)
    if (port.commercial !== null) parts.push(`🚛 ${lang === 'es' ? 'Camión' : 'Truck'}: ${fmt(port.commercial)}`)

    const text = lang === 'es'
      ? `🌉 ${port.portName} — espera ahorita:\n${parts.join(' · ')}`
      : `🌉 ${port.portName} wait times right now:\n${parts.join(' · ')}`

    const v = port.vehicle
    const hasSnapshot = typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 240
    const url = hasSnapshot
      ? `https://cruzar.app/w/${port.portId}/${v}`
      : 'https://cruzar.app'

    let shared = false
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cruzar', text, url })
        shared = true
        trackEvent('share_completed', { source: 'port_card', port_id: port.portId, channel: 'native' })
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(`${text}\n\n${url}`)
      } catch { /* ignore */ }
      setShowToast(true)
      setTimeout(() => setShowToast(false), 4000)
    }

    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  return (
    <Link href={`/cruzar/${slugForPort(port.portId)}`}>
      {/* Card — dark navy surface with status-reactive left accent bar */}
      <div className={[
        'relative overflow-hidden rounded-2xl border cursor-pointer',
        'bg-white dark:bg-[#161d2e]',
        'border-gray-200 dark:border-white/[0.07]',
        'active:scale-[0.985] transition-[transform,border-color,box-shadow] duration-150',
        HOVER_GLOW[statusLevel],
      ].join(' ')}>

        {/* Left accent bar — 3px status-colored stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${ACCENT_BAR[statusLevel]}`} />

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="pl-4 pr-4 pt-3.5 pb-3">

          {/* Top row: port name + hero wait number */}
          <div className="flex items-start justify-between gap-2">

            {/* Left: name, crossing, badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-[15px] leading-tight truncate">
                  {port.portName}
                </h3>
              </div>
              {displayCrossing && (
                <p className="text-[10px] font-mono tracking-[0.08em] uppercase text-gray-400 dark:text-white/30 mt-0.5 ml-4 truncate">
                  {displayCrossing}
                </p>
              )}

              {/* My-report ownership badge */}
              {myReportAge != null && (
                <div className="ml-4 mt-1 inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-full px-2 py-0.5">
                  <span className="text-[10px] leading-none">📣</span>
                  <span className="text-[10px] font-black text-green-700 dark:text-green-300 uppercase tracking-wide">
                    {lang === 'es'
                      ? (myReportAge < 1 ? 'Tú reportaste ahora' : `Tú reportaste hace ${myReportAge} min`)
                      : (myReportAge < 1 ? 'You reported now' : `You reported ${myReportAge}m ago`)}
                  </span>
                </div>
              )}

              {/* Pro live camera chip */}
              {hasProLiveCamera(port.portId) && (
                <div className="ml-4 mt-1 inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/40 rounded-full px-2 py-0.5">
                  <span className="text-[10px] leading-none">📹</span>
                  <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                    {lang === 'es' ? 'Video en vivo · Pro' : 'Live video · Pro'}
                  </span>
                </div>
              )}

              {/* Freshness badge — CBP data age with live pulse */}
              {port.cbpStaleMin != null && !port.noData && (
                <div className="ml-4 mt-1 inline-flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      port.cbpStaleMin <= 5 ? 'bg-green-400'
                        : port.cbpStaleMin <= 15 ? 'bg-amber-400'
                        : 'bg-gray-400'
                    }`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      port.cbpStaleMin <= 5 ? 'bg-green-500'
                        : port.cbpStaleMin <= 15 ? 'bg-amber-500'
                        : 'bg-gray-500'
                    }`} />
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${
                    port.cbpStaleMin <= 5 ? 'text-green-700 dark:text-green-400'
                      : port.cbpStaleMin <= 15 ? 'text-amber-700 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {port.cbpStaleMin < 1
                      ? (lang === 'es' ? 'En vivo · ahora' : 'Live · now')
                      : (lang === 'es' ? `CBP · hace ${port.cbpStaleMin} min` : `CBP · ${port.cbpStaleMin}m ago`)}
                  </span>
                </div>
              )}
            </div>

            {/* Right: hero wait number (Bricolage Grotesque) */}
            {primaryWait !== null && !port.isClosed && (
              <div className="text-right flex-shrink-0">
                {primaryWait === 0 ? (
                  <span className={`font-display font-black tabular-nums leading-none text-[36px] ${HERO_NUM[statusLevel]}`}>
                    &lt;1
                  </span>
                ) : primaryWait >= 60 ? (
                  <div>
                    <span className={`font-display font-black tabular-nums leading-none text-[36px] ${HERO_NUM[statusLevel]}`}>
                      {Math.floor(primaryWait / 60)}
                      <span className="text-[18px] text-gray-400 dark:text-white/40 tracking-tight">h</span>
                      {primaryWait % 60 > 0 && (
                        <>
                          {' '}
                          <span>{primaryWait % 60}</span>
                          <span className="text-[18px] text-gray-400 dark:text-white/40 tracking-tight">m</span>
                        </>
                      )}
                    </span>
                  </div>
                ) : (
                  <span className={`font-display font-black tabular-nums leading-none ${
                    primaryWait >= 100 ? 'text-[40px]' : 'text-[48px]'
                  } ${HERO_NUM[statusLevel]}`}>
                    {primaryWait}
                  </span>
                )}
                <p className="text-[9px] font-mono uppercase tracking-[0.1em] text-gray-400 dark:text-white/30 mt-0.5 text-right">
                  min
                </p>
                {carsAhead !== null && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-0.5">{t.carsAhead(carsAhead)}</p>
                )}
              </div>
            )}
          </div>

          {/* Source attribution line */}
          {(port.source || port.reportCount) && primaryWait !== null && (
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 ml-4">
              {(() => {
                const parts: string[] = []
                if (port.source === 'community')
                  parts.push(lang === 'es' ? `según ${port.reportCount} reportes` : `from ${port.reportCount} reports`)
                else if (port.source === 'consensus')
                  parts.push(
                    lang === 'es'
                      ? `consenso · CBP + ${port.reportCount ? `${port.reportCount} reportes` : 'tráfico'}`
                      : `consensus · CBP + ${port.reportCount ? `${port.reportCount} reports` : 'traffic'}`
                  )
                else if (port.source === 'traffic')
                  parts.push(lang === 'es' ? 'estimado por tráfico' : 'traffic-estimated')
                else parts.push(lang === 'es' ? 'según CBP' : 'per CBP')

                if (port.lastReportMinAgo != null && port.lastReportMinAgo <= 30)
                  parts.push(lang === 'es' ? `último reporte hace ${port.lastReportMinAgo} min` : `last report ${port.lastReportMinAgo} min ago`)
                else if (port.cbpStaleMin != null && port.cbpStaleMin > 25)
                  parts.push(lang === 'es' ? `CBP hace ${port.cbpStaleMin} min` : `CBP ${port.cbpStaleMin} min ago`)

                return parts.join(' · ')
              })()}
            </p>
          )}

          {/* Signal badge */}
          {signal && (
            <div className={`mt-2 px-2 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
              signal.type === 'accident' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
              signal.type === 'delay'    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
              signal.type === 'clear'    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                                           'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            }`}>
              {signal.type === 'accident' && `💥 ${lang === 'es' ? `${signal.count} reportan accidente` : `${signal.count} reporting accident`}`}
              {signal.type === 'delay'    && `⚠️ ${lang === 'es' ? `${signal.count} reportan más espera` : `${signal.count} reporting longer wait`}`}
              {signal.type === 'clear'    && `🟢 ${lang === 'es' ? `${signal.count} reportan que fluye` : `${signal.count} say it's moving fast`}`}
              {signal.type === 'crossed'  && (() => {
                const laneIcon =
                  signal.laneType === 'sentri' ? '⚡ SENTRI' :
                  signal.laneType === 'pedestrian' ? (lang === 'es' ? '🚶 a pie' : '🚶 walking') :
                  signal.laneType === 'commercial' ? (lang === 'es' ? '🚛 camión' : '🚛 truck') :
                  signal.laneType === 'vehicle' ? (lang === 'es' ? '🚗 en auto' : '🚗 by car') :
                  null
                const lanePart = laneIcon ? ` · ${laneIcon}` : ''
                return `✅ ${lang === 'es'
                  ? `Alguien cruzó hace ${signal.minutesAgo} min${signal.waited ? ` · esperó ${signal.waited} min` : ''}${lanePart}`
                  : `Someone crossed ${signal.minutesAgo} min ago${signal.waited ? ` · waited ${signal.waited} min` : ''}${lanePart}`}`
              })()}
            </div>
          )}

          {/* ── Lane data area ─────────────────────────────────────── */}
          {port.isClosed ? (
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {lang === 'es' ? 'Cerrado' : 'Closed'}
              </p>
            </div>
          ) : !allNull || port.vehicleClosed || port.pedestrianClosed || port.commercialClosed ? (
            <>
              {/* Best-lane savings callout — shown when a faster lane saves 10+ min */}
              {(() => {
                const car = port.vehicle
                const lanes: { key: 'sentri' | 'pedestrian'; min: number; label: string; emoji: string }[] = []
                if (port.sentri != null && car != null && port.sentri < car - 10) {
                  lanes.push({ key: 'sentri', min: port.sentri, label: 'SENTRI', emoji: '⚡' })
                }
                if (port.pedestrian != null && car != null && port.pedestrian < car - 15) {
                  lanes.push({ key: 'pedestrian', min: port.pedestrian, label: lang === 'es' ? 'A pie' : 'Walking', emoji: '🚶' })
                }
                if (lanes.length === 0 || car == null) return null
                const best = lanes.reduce((a, b) => (b.min < a.min ? b : a))
                const savings = car - best.min
                return (
                  <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-sm">{best.emoji}</span>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {lang === 'es'
                        ? `${best.label} ahorra ${savings} min`
                        : `${best.label} saves ${savings} min`}
                    </span>
                  </div>
                )
              })()}

              {/* Lane chips — compact inline replacement for WaitBadge row */}
              {laneChipItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {laneChipItems.map(lane => {
                    const laneLevel = lane.isClosed ? 'closed' : getWaitLevel(lane.min)
                    const chipTime = lane.isClosed
                      ? (lang === 'es' ? 'Cerrado' : 'Closed')
                      : lane.min === null ? '—'
                      : lane.min === 0 ? '<1m'
                      : `${lane.min}m`
                    return (
                      <span key={lane.key} className={[
                        'inline-flex items-center gap-1 rounded-[5px] px-2 py-[3px]',
                        'font-mono text-[9px] uppercase tracking-wider border',
                        lane.isSentri
                          ? 'text-blue-400 border-blue-400/25 bg-blue-400/[0.07] dark:text-blue-300 dark:border-blue-300/20 dark:bg-blue-400/[0.06]'
                          : lane.isClosed
                            ? 'text-gray-400 border-gray-200 dark:border-white/[0.06] dark:bg-white/[0.03]'
                            : laneLevel === 'low'
                              ? 'text-gray-600 dark:text-white/45 border-gray-200 dark:border-white/[0.08] dark:bg-white/[0.04]'
                              : laneLevel === 'medium'
                                ? 'text-amber-600 dark:text-amber-400/80 border-amber-200 dark:border-amber-400/20 dark:bg-amber-400/[0.05]'
                                : 'text-red-600 dark:text-red-400/80 border-red-200 dark:border-red-400/20 dark:bg-red-400/[0.05]',
                      ].join(' ')}>
                        <span>{lane.label}</span>
                        <span className="font-semibold">{chipTime}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </>
          ) : port.historicalVehicle != null ? (
            <div
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/cruzar/${slugForPort(port.portId)}?report=1` }}
              className="mt-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  {lang === 'es'
                    ? `📊 ~${port.historicalVehicle} min · típico pa' esta hora`
                    : `📊 ~${port.historicalVehicle} min · usual at this hour`}
                </p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  {lang === 'es'
                    ? 'Promedio de los últimos 30 días · reporta pa\' actualizar'
                    : 'Average from the last 30 days · report to update'}
                </p>
              </div>
              <span className="text-xs font-bold text-white bg-indigo-600 rounded-lg px-3 py-1.5 whitespace-nowrap">
                {lang === 'es' ? 'Reportar' : 'Report'}
              </span>
            </div>
          ) : hasCamera(port.portId) ? (
            <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {lang === 'es' ? '📷 Datos limitados · cámara disponible' : '📷 Limited data · camera available'}
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  {lang === 'es'
                    ? 'CBP no reporta ahorita · ve la webcam para checar la fila'
                    : 'CBP not reporting right now · check the webcam to see the line'}
                </p>
              </div>
              <span className="text-xs font-bold text-white bg-blue-600 rounded-lg px-3 py-1.5 whitespace-nowrap">
                {lang === 'es' ? 'Ver' : 'View'}
              </span>
            </div>
          ) : (
            <div
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/cruzar/${slugForPort(port.portId)}?report=1` }}
              className="mt-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {lang === 'es' ? 'Datos limitados' : 'Limited data'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {lang === 'es'
                    ? 'CBP no reporta ahorita · reporta si estás ahí'
                    : 'CBP not reporting right now · report if you\'re there'}
                </p>
              </div>
              <span className="text-xs font-bold text-white bg-gray-700 dark:bg-gray-600 rounded-lg px-3 py-1.5 whitespace-nowrap">
                {lang === 'es' ? 'Reportar' : 'Report'}
              </span>
            </div>
          )}
        </div>

        {/* ── Action buttons ─────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-1.5 px-4 py-2.5 border-t border-gray-100 dark:border-white/[0.06]">
          <button
            onClick={handleStar}
            className={`cruzar-press-sm p-2 rounded-lg bg-gray-50 dark:bg-white/[0.05] ${
              starred ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
            }`}
            title={lang === 'es' ? (starred ? 'Quitar de favoritos' : 'Guardar en favoritos') : (starred ? 'Remove from favorites' : 'Save to favorites')}
            aria-pressed={starred}
          >
            <Star className={`w-4 h-4 ${starred ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={handleAlertBell}
            className="cruzar-press-sm p-2 rounded-lg bg-gray-50 dark:bg-white/[0.05] text-gray-400 hover:text-blue-500"
            title={lang === 'es' ? 'Avísame cuando baje' : 'Alert me when wait drops'}
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); tapLight(); setShowReportSheet(true) }}
            className="cruzar-press-sm p-2 rounded-lg bg-gray-50 dark:bg-white/[0.05] text-gray-400 hover:text-emerald-500"
            title={lang === 'es' ? 'Reportar estado' : 'Report status'}
            aria-label={lang === 'es' ? 'Reportar estado' : 'Report status'}
          >
            <Megaphone className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            className="cruzar-press-sm p-2 rounded-lg bg-gray-50 dark:bg-white/[0.05] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            title="Share wait times"
          >
            {shared ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Clipboard copy toast */}
        {showToast && (
          <div className="mx-4 mb-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 font-medium">
            <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            {lang === 'es' ? '¡Copiado! Pégalo en tu grupo de Facebook.' : 'Copied! Paste it into your Facebook group.'}
          </div>
        )}
      </div>

      {/* Modals — rendered inside Link but use fixed positioning */}
      <SignupIntentModal
        open={signupModalIntent !== null}
        onClose={() => setSignupModalIntent(null)}
        intent={signupModalIntent ?? 'favorite'}
        portId={port.portId}
        portName={port.portName}
        nextPath={`/cruzar/${slugForPort(port.portId)}`}
      />
      <BridgeAlertSheet
        open={showAlertSheet}
        onClose={() => setShowAlertSheet(false)}
        portId={port.portId}
        portName={port.portName}
      />
      <BridgeReportSheet
        open={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        portId={port.portId}
        portName={port.portName}
      />
    </Link>
  )
}
