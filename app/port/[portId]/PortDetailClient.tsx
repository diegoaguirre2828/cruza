'use client'

import { useState, useEffect } from 'react'
import { LockedFeatureWall } from '@/components/LockedFeatureWall'
import { formatWaitLabel } from '@/lib/formatWait'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { PushToggle } from '@/components/PushToggle'
import { ReportForm } from '@/components/ReportForm'
import { ReportsFeed } from '@/components/ReportsFeed'
import { BridgeCameras } from '@/components/BridgeCameras'
import { CommunityBridgePhotos } from '@/components/CommunityBridgePhotos'
import { PortFAQ } from '@/components/PortFAQ'
import { cityForPortId } from '@/lib/cityMeta'
import { PortDetailHero } from '@/components/PortDetailHero'
import { WaitConfirmStrip } from '@/components/WaitConfirmStrip'
import { trackEvent } from '@/lib/trackEvent'
import { getPortMeta } from '@/lib/portMeta'
import { getAffiliate } from '@/lib/affiliates'
import { AdBanner } from '@/components/AdBanner'
import { JustCrossedPrompt } from '@/components/JustCrossedPrompt'
import { PriorityNudge, type NudgeSpec } from '@/components/PriorityNudge'
import { armNudge } from '@/lib/useNudge'
import { trackShare } from '@/lib/trackShare'
import { useAuth } from '@/lib/useAuth'
import { useTier, canAccess } from '@/lib/useTier'
import Link from 'next/link'
import { SignupIntentModal, type SignupIntent } from '@/components/SignupIntentModal'
import { recordPortView } from '@/lib/recentPorts'
import { Bell, Share2, Check, Megaphone } from 'lucide-react'
import { BridgeReportSheet } from '@/components/BridgeReportSheet'
import { BridgeMomentChips } from '@/components/BridgeMomentChips'
import { FirstAlertNudge } from '@/components/FirstAlertNudge'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime, WaitTimeReading } from '@/types'

interface Prediction {
  datetime: string
  hour: number
  predictedWait: number | null
  confidence: string
}

interface Props {
  port: PortWaitTime
  portId: string
}

interface BestTime {
  hour: number
  avgWait: number
  samples: number
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour < 12) return `${hour}am`
  if (hour === 12) return '12pm'
  return `${hour - 12}pm`
}

// Priority-ordered contextual nudges for port detail. PriorityNudge
// renders only the first ARMED one (pending/seen). Each is armed
// by a different trigger elsewhere in the app:
//   - alerts_for_this_bridge: armed on 2nd port-detail visit (see
//     useEffect below)
//   - try_route_optimizer: armed for Pro/Business on any port-detail
//     view (the feature is paid-for; they need to find it)
//   - saved_bridge_invite_circle: armed in HomeClient when a user
//     saves their first bridge (reused from home)
// PORT_DETAIL_NUDGES emptied 2026-05-02 — try_route_optimizer is now
// a header pill, alerts_for_this_bridge is the FirstAlertNudge auto-
// drawer, saved_bridge_invite_circle is gone with the circles kill.
// Array intentionally empty so PriorityNudge renders nothing here.
const PORT_DETAIL_NUDGES: NudgeSpec[] = []

export function PortDetailClient({ port, portId }: Props) {
  const { user, loading: authLoading } = useAuth()
  const { tier } = useTier()
  const { lang } = useLang()
  const es = lang === 'es'
  const [history, setHistory] = useState<WaitTimeReading[]>([])
  const [bestTimes, setBestTimes] = useState<BestTime[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [reportRefresh, setReportRefresh] = useState(0)
  const [reportPulse, setReportPulse] = useState(false)

  // bridge_detail_viewed + at_port detection. Fires on mount with
  // best-effort geo (no prompt). Tracks dwell time and fires
  // bridge_detail_dwell on unmount. Diego 2026-05-03 audit: "are people
  // checking from the line or from home?"
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mountedAt = Date.now()
    const portMeta = getPortMeta(portId)
    const meta = (portMeta?.lat != null && portMeta?.lng != null) ? { lat: portMeta.lat, lng: portMeta.lng } : null

    function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    }

    function fireView(at_port: boolean | null, distance_km: number | null) {
      trackEvent('bridge_detail_viewed', {
        port_id: portId,
        port_name: port.portName,
        at_port,
        distance_km,
      })
      if (at_port) {
        trackEvent('wait_checked_at_port', {
          port_id: portId,
          port_name: port.portName,
          distance_km,
          live_wait: port.vehicle ?? null,
        })
      }
    }

    let fired = false
    if (meta && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(p => {
          if (p.state === 'granted' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (fired) return
                fired = true
                const km = haversineKm(pos.coords.latitude, pos.coords.longitude, meta.lat, meta.lng)
                fireView(km <= 3, Math.round(km * 10) / 10)
              },
              () => { if (!fired) { fired = true; fireView(null, null) } },
              { maximumAge: 5 * 60 * 1000, timeout: 4000, enableHighAccuracy: false },
            )
          } else if (!fired) {
            fired = true
            fireView(null, null)
          }
        })
        .catch(() => { if (!fired) { fired = true; fireView(null, null) } })
    } else {
      fired = true
      fireView(null, null)
    }

    return () => {
      const dwell_ms = Date.now() - mountedAt
      // Bounce signal: closed within 5s of seeing the wait number
      trackEvent('bridge_detail_dwell', {
        port_id: portId,
        dwell_ms,
        bounce: dwell_ms < 5000,
      })
    }
  }, [portId, port.portName, port.vehicle])

  // When the user lands from the no-data 'Be the first to report' CTA
  // (?report=1 or #report), jump straight to the report form and
  // highlight it briefly so they don't have to hunt.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const wants = params.get('report') === '1' || window.location.hash === '#report'
    if (!wants) return
    // Wait a tick for the form to be mounted, then scroll into view
    const id = setTimeout(() => {
      const el = document.getElementById('report')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setReportPulse(true)
        setTimeout(() => setReportPulse(false), 2400)
      }
    }, 120)
    return () => clearTimeout(id)
  }, [])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showReportSheet, setShowReportSheet] = useState(false)
  const [alertThreshold, setAlertThreshold] = useState(20)
  const [alertSaved, setAlertSaved] = useState(false)
  const [alertSaving, setAlertSaving] = useState(false)
  // Moments-of-want signup modal — opened when guests click save / alert.
  // Replaces the previous "silent return" gate that converted at ~10%.
  const [signupModalIntent, setSignupModalIntent] = useState<SignupIntent | null>(null)

  // Track this port view in localStorage so /signup can personalize +
  // /welcome's geolocation fallback can prefer ports the user actually
  // checked. Fires once per portId per mount.
  useEffect(() => {
    if (portId) recordPortView(portId)
  }, [portId])
  // Whether the current user already has an active alert for THIS
  // port. Drives the one-tap "Create alert" CTA near the hero: if
  // they have one we show "Alert active · manage", otherwise we show
  // the big create-alert button. Null = still loading.
  const [hasAlertForPort, setHasAlertForPort] = useState<boolean | null>(null)
  type CommunitySignal = { type: 'accident' | 'inspection' | 'worse' | 'better'; count: number }
  const [communitySignal, setCommunitySignal] = useState<CommunitySignal | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [showJustCrossed, setShowJustCrossed] = useState(false)
  const [lastCrossed, setLastCrossed] = useState<{ minutesAgo: number; waited: number | null } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [histRes, bestRes, predRes, reportsRes] = await Promise.all([
          fetch(`/api/ports/${encodeURIComponent(portId)}/history`),
          fetch(`/api/ports/${encodeURIComponent(portId)}/best-times`),
          fetch(`/api/predictions?portId=${encodeURIComponent(portId)}`),
          fetch(`/api/reports?portId=${encodeURIComponent(portId)}&limit=20`),
        ])
        if (histRes.ok) {
          const { history } = await histRes.json()
          setHistory(history || [])
        }
        if (bestRes.ok) {
          const { bestTimes } = await bestRes.json()
          setBestTimes(bestTimes || [])
        }
        if (predRes.ok) {
          const { predictions } = await predRes.json()
          setPredictions(predictions || [])
        }
        if (reportsRes.ok) {
          const { reports } = await reportsRes.json()
          const cutoff = Date.now() - 30 * 60 * 1000
          const recent: { report_type: string; created_at: string; wait_minutes?: number }[] = (reports || [])
            .filter((r: { created_at: string }) => new Date(r.created_at).getTime() > cutoff)

          const accidents   = recent.filter(r => r.report_type === 'accident').length
          const inspections = recent.filter(r => r.report_type === 'inspection').length
          const delays      = recent.filter(r => r.report_type === 'delay').length
          const clears      = recent.filter(r => r.report_type === 'clear').length

          // Priority order: accident > inspection > delay surge > clearing
          // Require 2+ reports from DIFFERENT users for serious signals
          // (accident, inspection) to prevent single-user false alarms.
          const uniqueAccidentReporters = new Set(
            recent.filter(r => r.report_type === 'accident').map((r: any) => r.user_id || r.username || 'anon')
          ).size
          const uniqueInspectionReporters = new Set(
            recent.filter(r => r.report_type === 'inspection').map((r: any) => r.user_id || r.username || 'anon')
          ).size

          if (accidents >= 2 && uniqueAccidentReporters >= 2) {
            setCommunitySignal({ type: 'accident', count: accidents })
          } else if (accidents === 1) {
            // Show unverified single report with softer language
            setCommunitySignal({ type: 'accident', count: 1 })
          } else if (inspections >= 2 && uniqueInspectionReporters >= 2) {
            setCommunitySignal({ type: 'inspection', count: inspections })
          } else if (inspections === 1) {
            setCommunitySignal({ type: 'inspection', count: 1 })
          } else if (delays >= 3 && delays > clears * 2) {
            setCommunitySignal({ type: 'worse', count: delays })
          } else if (clears >= 3 && clears > delays * 2) {
            setCommunitySignal({ type: 'better', count: clears })
          }

          // Last crossed — most recent report with wait_minutes
          const crossed = (reports || []).find((r: { wait_minutes?: number; created_at: string }) => r.wait_minutes != null)
          if (crossed) {
            const minutesAgo = Math.round((Date.now() - new Date(crossed.created_at).getTime()) / 60000)
            if (minutesAgo <= 60) setLastCrossed({ minutesAgo, waited: crossed.wait_minutes })
          }
        }
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [portId])

  // Capture ?ref= from URL and store for use on signup/report
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref && ref.length > 10) {
      localStorage.setItem('cruzar_ref', ref)
      localStorage.setItem('cruzar_ref_port', portId)
      localStorage.setItem('cruzar_ref_ts', String(Date.now()))
    }
  }, [portId])

  // Contextual discovery: arm nudges based on bridge-specific engagement.
  // Logic:
  //   - Track per-port visit count in localStorage
  //   - On 2nd+ visit: arm `alerts_for_this_bridge` (only hits users
  //     who keep coming back to the same port — they're the ones who
  //     actually benefit from an alert)
  //   - For Pro users, arm `try_route_optimizer` once they've viewed
  //     any port detail (they already have the feature; just need to
  //     find it)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const key = `cruzar_port_visits_${portId}`
      const prev = parseInt(localStorage.getItem(key) || '0', 10) || 0
      const next = prev + 1
      localStorage.setItem(key, String(next))
      if (next >= 2) armNudge('alerts_for_this_bridge')
      if (tier === 'pro' || tier === 'business') armNudge('try_route_optimizer')
    } catch { /* ignore */ }
  }, [portId, tier])

  // Check whether the authenticated user already has an alert for this
  // port. Drives the one-tap "Create alert for this bridge" CTA — if
  // an alert exists we show a subtle "active · manage" pill instead
  // so we don't badger the user about a hook they already set.
  useEffect(() => {
    if (!user) { setHasAlertForPort(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/alerts', { credentials: 'include' })
        if (!res.ok) { if (!cancelled) setHasAlertForPort(false); return }
        const data = await res.json()
        const alerts: Array<{ port_id: string }> = Array.isArray(data?.alerts) ? data.alerts : []
        const hasOne = alerts.some(a => a.port_id === portId)
        if (!cancelled) setHasAlertForPort(hasOne)
      } catch {
        if (!cancelled) setHasAlertForPort(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, portId, alertSaved])

  async function handleShare() {
    // Use the share-snapshot URL when we have a live number: the wait time is
    // baked into the URL path, so the OG preview rendered by WhatsApp / FB /
    // Twitter always shows a real number. Each distinct wait value produces a
    // distinct URL, which sidesteps the aggressive OG-image caching the
    // homepage ran into with its previous "live" evergreen image.
    const v = port.vehicle
    const hasSnapshot = typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 240
    const url = hasSnapshot
      ? `https://cruzar.app/w/${portId}/${v}${user ? `?ref=${user.id}` : ''}`
      : user
        ? `https://cruzar.app/port/${portId}?ref=${user.id}`
        : `https://cruzar.app/port/${portId}`
    const text = hasSnapshot
      ? es
        ? `${port.portName} está en ${v} min ahorita — cruzar.app`
        : `${port.portName} is ${v} min right now — cruzar.app`
      : es
        ? `Tiempos de espera en vivo en ${port.portName} — cruzar.app`
        : `Live wait times at ${port.portName} — cruzar.app`

    if (navigator.share) {
      try {
        trackShare('native', 'port_detail')
        await navigator.share({ title: port.portName, text, url })
        trackEvent('share_completed', { source: 'port_detail', port_id: portId, channel: 'native' })
      } catch { /* cancelled */ }
    } else {
      trackShare('copy', 'port_detail')
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    }
  }

  const chartData = history.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    vehicle: r.vehicle_wait,
    pedestrian: r.pedestrian_wait,
  }))

  async function saveAlert() {
    // Moments-of-want gate — guests get the inline signup modal instead of
    // a silent fail. Pre-fills the threshold the user just chose so the
    // intent flows through /signup → /welcome → /api/alerts cleanly.
    if (!user) {
      setSignupModalIntent('alert')
      return
    }
    setAlertSaving(true)
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portId, laneType: 'vehicle', thresholdMinutes: alertThreshold }),
    })
    if (res.ok) {
      setAlertSaved(true)
      trackEvent('alert_created', {
        port_id: portId,
        source: 'port_detail',
        lane: 'vehicle',
        threshold: alertThreshold,
      })
      // Fuse push permission with alert creation. Any listener (the
      // dashboard push nudge, a future in-page prompt) can react to
      // this event to surface the push prompt immediately.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cruzar:alert-created', { detail: { portId } }))
      }
    }
    setAlertSaving(false)
  }

  async function toggleSave() {
    // Moments-of-want gate — guests get the inline signup modal instead of
    // the previous silent return. Modal pushes them through /signup with
    // the favorite intent queued; /welcome saves the bridge post-auth.
    if (!user) {
      setSignupModalIntent('favorite')
      return
    }
    setSaving(true)
    if (saved) {
      await fetch(`/api/saved?portId=${encodeURIComponent(portId)}`, { method: 'DELETE' })
      setSaved(false)
    } else {
      await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId }),
      })
      setSaved(true)
      // Best-effort: also create a default 30-min vehicle alert so the
      // favorite ⭐ tap actually wires push for this bridge. Free tier
      // caps at 1 alert — silently no-op if cap exceeded (OneTapAlertCard
      // handles the upgrade nudge on the home Mi-puente panel). Reason
      // this exists: 2026-05-02 Diego favorited a bridge, never got a
      // push — favorite alone only writes saved_crossings, which no cron
      // reads.
      fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId, laneType: 'vehicle', thresholdMinutes: 30 }),
      }).catch(() => { /* silent — cap or duplicate */ })
      armNudge('saved_bridge_invite_circle')
    }
    setSaving(false)
  }

  const avgVehicleWait = (() => {
    const readings = history.filter(r => r.vehicle_wait !== null)
    if (!readings.length) return null
    return Math.round(readings.reduce((sum, r) => sum + (r.vehicle_wait ?? 0), 0) / readings.length)
  })()

  const vehicleTrend = (() => {
    if (history.length < 2) return { dir: 'stable' as const, delta: 0 }
    const latest = history[history.length - 1]
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const older = [...history].reverse().find(r => new Date(r.recorded_at) <= thirtyMinAgo)
    if (!older) return { dir: 'stable' as const, delta: 0 }
    const diff = (latest.vehicle_wait ?? 0) - (older.vehicle_wait ?? 0)
    if (diff >= 3) return { dir: 'up' as const, delta: diff }
    if (diff <= -3) return { dir: 'down' as const, delta: diff }
    return { dir: 'stable' as const, delta: diff }
  })()

  const leaveRecommendation = (() => {
    if (!bestTimes.length) return null
    const currentHour = new Date().getHours()
    return bestTimes
      .filter(bt => bt.avgWait <= 25 && bt.hour > currentHour && bt.hour <= currentHour + 10)
      .sort((a, b) => a.avgWait - b.avgWait)[0] ?? null
  })()

  const contextualDelay = (() => {
    if (!bestTimes.length || port.vehicle === null || loadingHistory) return null
    const currentHour = new Date().getHours()
    const typicalNow = bestTimes.find(bt => bt.hour === currentHour)
    if (!typicalNow || typicalNow.samples < 3) return null
    const diff = port.vehicle - typicalNow.avgWait
    if (diff >= 10) return { type: 'above' as const, diff: Math.round(diff), typical: typicalNow.avgWait }
    if (diff <= -10) return { type: 'below' as const, diff: Math.round(Math.abs(diff)), typical: typicalNow.avgWait }
    return null
  })()

  const predictionChartData = predictions
    .filter(p => p.predictedWait !== null)
    .map(p => ({
      time: new Date(p.datetime).toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', hour12: true }),
      predicted: p.predictedWait,
      confidence: p.confidence,
    }))

  const clearingTime = (() => {
    if (!canAccess(tier, 'ai_predictions') || !predictionChartData.length) return null
    const next = predictionChartData.slice(1).find(p => (p.predicted as number) <= 20)
    return next?.time ?? null
  })()

  // Guest treatment — in-place LockedFeatureWall instead of a redirect.
  // Diego's 2026-04-14 late directive: "shows that features are locked
  // and to make an account." The user stays on /port/[id], sees the
  // bridge name + a teaser wait number, and sees exactly what signing
  // up would unlock. Back button returns them to wherever they came
  // from (home, FB group, etc.) without any navigation trap.
  if (authLoading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {es ? 'Cargando…' : 'Loading…'}
        </p>
      </div>
    )
  }
  if (!user) {
    const teaser = port.vehicle != null
      ? formatWaitLabel(port.vehicle, es ? 'es' : 'en')
      : es ? 'En vivo' : 'Live'
    return (
      <LockedFeatureWall
        nextPath={`/port/${portId}`}
        featureTitleEs={`Detalles completos de ${port.portName}`}
        featureTitleEn={`Full details for ${port.portName}`}
        summaryEs={`El tiempo de espera ahorita es ${teaser}. Crea tu cuenta gratis pa' desbloquear todo lo demás que sabemos de este puente.`}
        summaryEn={`Current wait is ${teaser}. Create a free account to unlock everything we know about this crossing.`}
        unlocks={[
          { es: 'Cámaras en vivo del puente', en: 'Live bridge cameras' },
          { es: 'Patrón por hora de los últimos 30 días', en: 'Hourly pattern from the last 30 days' },
          { es: 'Mejor hora pa\' cruzar basado en tus datos', en: 'Best hour to cross based on your data' },
          { es: 'Alertas push cuando baje de 30 min', en: 'Push alerts when it drops below 30 min' },
          { es: 'Reportes de la comunidad en vivo', en: 'Live community reports' },
          { es: 'Guardar este puente en favoritos', en: 'Save this bridge to favorites' },
          { es: 'Reportar tu propio tiempo de espera', en: 'Report your own wait time' },
        ]}
      />
    )
  }

  return (
    <div className="space-y-4">
      <JustCrossedPrompt
        portId={portId}
        portName={port.portName}
        onSubmitted={() => { setReportRefresh(r => r + 1); setShowJustCrossed(false) }}
        forceShow={showJustCrossed}
        onDismiss={() => setShowJustCrossed(false)}
      />

      {/* Last crossed banner */}
      {lastCrossed && !showJustCrossed && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-green-800 dark:text-green-300">
            ✅ {es
              ? `Alguien cruzó hace ${lastCrossed.minutesAgo} min${lastCrossed.waited ? ` · esperó ${lastCrossed.waited} min` : ''}`
              : `Someone crossed ${lastCrossed.minutesAgo} min ago${lastCrossed.waited ? ` · waited ${lastCrossed.waited} min` : ''}`}
          </p>
        </div>
      )}

      {/* Two primary actions: Reportar (megaphone — opens BridgeReportSheet
          which folds in share-via-success-toast) + Guardar. Diego
          2026-05-02: "share the view part of the individual bridge
          page should be just part of the report part, they can do
          either or." Standalone Compartir button removed; share now
          lives inside the report sheet's success path + the small
          share icon below the hero. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowReportSheet(true)}
          className="flex flex-col items-center justify-center gap-1 py-3.5 px-1 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-500 to-green-600 text-white text-[12px] font-black shadow-lg shadow-emerald-600/25 active:scale-[0.97] transition-all"
        >
          <Megaphone className="w-5 h-5" />
          <span className="leading-tight text-center truncate max-w-full">{es ? 'Reportar' : 'Report'}</span>
        </button>
        {user ? (
          <button
            onClick={toggleSave}
            disabled={saving}
            className={`flex flex-col items-center justify-center gap-1 py-3.5 px-1 rounded-xl border-2 text-[12px] font-black shadow-sm active:scale-[0.97] transition-all ${
              saved
                ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 active:bg-yellow-100 dark:active:bg-yellow-900/40'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:active:bg-gray-700'
            }`}
          >
            <span className="text-xl leading-none">{saved ? '⭐' : '☆'}</span>
            <span className="leading-tight text-center truncate max-w-full">{saved ? (es ? 'Guardado' : 'Saved') : (es ? 'Guardar' : 'Save')}</span>
          </button>
        ) : (
          <Link
            href="/signup"
            className="flex flex-col items-center justify-center gap-1 py-3.5 px-1 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-[12px] font-black shadow-sm active:scale-[0.97] active:bg-gray-50 dark:active:bg-gray-700 transition-all"
          >
            <span className="text-xl leading-none">☆</span>
            <span className="leading-tight text-center truncate max-w-full">{es ? 'Guardar' : 'Save'}</span>
          </Link>
        )}
      </div>

      {/* Quick share affordance — collapsed below the primary report
          CTA so "I just want to forward this number" stays a 1-tap
          action without competing visually with the report flow. */}
      <button
        onClick={handleShare}
        className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-[0.99] transition-transform"
      >
        {shareCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
        {shareCopied ? (es ? '¡Copiado!' : 'Copied!') : (es ? 'Compartir tiempo' : 'Share wait time')}
      </button>

      {/* Live wait now lives in the page header (app/cruzar/[slug]/page.tsx)
          per Diego 2026-05-02 — frees up vertical space for the carousel
          and cameras. Carousel below holds patterns / forecast / Saturday. */}
      <BridgeMomentChips portId={portId} port={port} />

      {/* PortDetailHero + CrossingVerdict removed 2026-05-02 — folded
          into the BridgeMomentChips carousel above. Lane breakdown now
          lives in the "Now" card; verdict ("faster than typical") is
          inline on the same card; Best/Rush/Today rail is replaced by
          the rotating Today/Saturday/6h cards. /port/[id]/advanced is
          a double-tap away from any carousel card. */}

      {/* Live bridge camera — promoted 2026-04-28 to sit directly under
          the hero. Diego: "the live cameras in individual bridge pages
          should be more up top." Verifying the wait visually is the
          highest-leverage move right after seeing the number. */}
      <BridgeCameras portId={portId} portName={port.portName} />

      {/* Community wait-time confirmation — Bordify gap fix
          (2026-04-26 competitor analysis). One-tap "es correcto / no"
          on the displayed CBP wait. Builds the accuracy moat the
          /api/cron/analyze-bridge-cameras + 230k wait_time_readings
          already deserve to surface. */}
      <WaitConfirmStrip portId={portId} cbpWait={port.vehicle ?? null} />

      {/* One-tap alert CTA — fights the 89% one-and-done retention
          problem. Users who land here came for a wait time number;
          the single highest-leverage thing we can do is turn them
          into someone with a reason to come back. If they already
          have an alert for THIS port, we show a subtle "active"
          pill with a manage link instead. Auth-only path — guests
          hit the LockedFeatureWall above. */}
      {user && hasAlertForPort === false && (
        <Link
          href={`/dashboard?tab=alerts&portId=${encodeURIComponent(portId)}`}
          className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-center font-black py-3.5 rounded-2xl shadow-md active:scale-[0.98] transition-all"
        >
          {es
            ? `🔔 Avísame cuando baje este puente`
            : `🔔 Alert me when this bridge clears`}
        </Link>
      )}
      {user && hasAlertForPort === true && (
        <Link
          href="/dashboard?tab=alerts"
          className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
        >
          <p className="text-sm font-bold text-green-800 dark:text-green-300">
            {es ? '✓ Alerta activa' : '✓ Alert active'}
          </p>
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">
            {es ? 'Administrar →' : 'Manage →'}
          </span>
        </Link>
      )}

      {/* 10s SharePrompt popup removed 2026-04-21 — it was the clearest
          example of ambient interruption, firing on every visit. Share
          is already a primary action in the action row at the top. */}

      {/* Community vs CBP signal */}
      {communitySignal && (() => {
        const cfg = {
          accident: {
            bg: communitySignal.count >= 2 ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
            text: communitySignal.count >= 2 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300',
            icon: communitySignal.count >= 2 ? '🚨' : '⚠️',
            en: communitySignal.count >= 2
              ? `${communitySignal.count} people reporting accident at this crossing — expect longer delays.`
              : `1 person reported an accident (unverified). Wait for others to confirm.`,
            es: communitySignal.count >= 2
              ? `${communitySignal.count} personas reportan accidente en este cruce — espera más retraso.`
              : `1 persona reportó un accidente (sin verificar). Espera confirmación de otros.`,
          },
          inspection: {
            bg: communitySignal.count >= 2 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
            text: communitySignal.count >= 2 ? 'text-blue-800 dark:text-blue-300' : 'text-amber-800 dark:text-amber-300',
            icon: communitySignal.count >= 2 ? '🔍' : '⚠️',
            en: communitySignal.count >= 2
              ? `Enhanced inspections reported — all lanes may be slower than usual.`
              : `1 person reported enhanced inspections (unverified).`,
            es: communitySignal.count >= 2
              ? `Se reportaron inspecciones reforzadas — todos los carriles pueden estar más lentos.`
              : `1 persona reportó inspecciones reforzadas (sin verificar).`,
          },
          worse: {
            bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
            text: 'text-amber-800 dark:text-amber-300',
            icon: '⚠️',
            en: `${communitySignal.count} drivers reporting longer waits than CBP currently shows.`,
            es: `${communitySignal.count} cruzantes reportan más espera de lo que indica CBP ahora.`,
          },
          better: {
            bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
            text: 'text-green-800 dark:text-green-300',
            icon: '✅',
            en: `${communitySignal.count} drivers reporting it's moving faster than CBP shows.`,
            es: `${communitySignal.count} cruzantes dicen que va más rápido de lo que indica CBP.`,
          },
        }[communitySignal.type]
        return (
          <div className={`rounded-2xl px-4 py-3 border flex items-start gap-2 ${cfg.bg}`}>
            <span className="text-base flex-shrink-0">{cfg.icon}</span>
            <div>
              <p className={`text-xs font-semibold leading-snug ${cfg.text}`}>
                {es ? cfg.es : cfg.en}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {es ? 'Reportado por la comunidad · últimos 30 min' : 'Community reported · last 30 min'}
              </p>
            </div>
          </div>
        )
      })()}

      {/* Contextual delay banner */}
      {(contextualDelay || clearingTime) && (
        <div className={`rounded-2xl px-4 py-3 border ${
          contextualDelay?.type === 'above'
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : contextualDelay?.type === 'below'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          {contextualDelay?.type === 'above' && (
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              ⚠️ {es
                ? `~${contextualDelay.diff} min más de lo usual a esta hora`
                : `~${contextualDelay.diff} min above usual for this time`}
            </p>
          )}
          {contextualDelay?.type === 'below' && (
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              ✅ {es
                ? `~${contextualDelay.diff} min menos de lo usual — buen momento para cruzar`
                : `~${contextualDelay.diff} min below usual — great time to cross`}
            </p>
          )}
          {!contextualDelay && clearingTime && (
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              🕐 {es
                ? `Se espera que despeje alrededor de las ${clearingTime}`
                : `Expected to clear around ${clearingTime}`}
            </p>
          )}
          {contextualDelay && clearingTime && (
            <p className={`text-xs mt-1 ${
              contextualDelay.type === 'above'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              {es
                ? `Se espera que despeje alrededor de las ${clearingTime}`
                : `Expected to clear around ${clearingTime}`}
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          LIVE COMMUNITY LAYER — promoted 2026-04-21 per Diego feedback.
          Users stop scrolling after "what people are seeing now" — the
          bridge chat and report form must be reachable without
          hunting past 6 sections of charts. Cameras + photos +
          affiliates + detailed stats now sit below.
          ═══════════════════════════════════════════════════════════════ */}

      {/* Charla del puente — the reports feed reframed as a live
          community chat. Same data as before, conversational framing.
          Non-gated on purpose — community features benefit from scale. */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">💬</span>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {es ? 'Charla del puente' : 'Bridge chat'}
            </h2>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            {es ? 'EN VIVO' : 'LIVE'}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 -mt-1 leading-snug">
          {es
            ? 'Lo que la gente está reportando ahorita · de más reciente a más antiguo'
            : 'What people are reporting right now · newest first'}
        </p>
        <ReportsFeed portId={portId} refresh={reportRefresh} />
      </div>

      {/* Submit report — moved up next to the chat so reporting is a
          one-scroll action from reading what others see. */}
      <div
        id="report"
        className={`bg-white dark:bg-gray-800 rounded-2xl border-2 p-5 shadow-sm scroll-mt-20 transition-all ${
          reportPulse
            ? 'border-blue-500 ring-4 ring-blue-500/30 shadow-xl'
            : 'border-blue-500 dark:border-blue-600'
        }`}
      >
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
          📣 {es ? '¿Cruzaste? Reporta aquí' : 'Did you cross? Report here'}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {es ? 'Ayuda a otros viajeros con tu reporte · Gana puntos' : 'Help fellow travelers with your report · Earn points'}
        </p>
        <ReportForm portId={portId} onSubmitted={() => setReportRefresh(r => r + 1)} port={port} />
      </div>

      {/* Proactive circle ping — only visible to logged-in users with circles */}

      {/* ═══════════════════════════════════════════════════════════════
          SECONDARY LAYER — cameras, community photos, affiliates, ad.
          Still visible, no longer blocking the chat.
          ═══════════════════════════════════════════════════════════════ */}

      {/* Community photo rail — user-submitted bridge photos. Live
          DOT cameras now sit directly under the hero (moved 2026-04-28).
          See project_cruzar_photo_metadata_moat_20260414.md for the
          full spec. */}
      <CommunityBridgePhotos portId={portId} portName={port.portName} />

      {/* Contextual affiliates — surface insurance + eSIM AT THE MOMENT
          OF NEED (someone staring at a bridge wait time is about to
          cross). Shown to all users, guest or auth, because affiliates
          are revenue and hiding them behind the Pro gate makes no sense. */}
      <PortDetailAffiliateCard portId={portId} es={es} />

      <div className="mb-4">
        <AdBanner slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_PORT} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          DEEP DATA LAYER — collapsed by default. Diego 2026-04-21:
          "historical patterns and live 24hours feel like filler for the
          typical user." Hidden behind a single disclosure so the typical
          user isn't scrolling past 4 charts, but the data nerd / Pro
          user can still reach it.
          ═══════════════════════════════════════════════════════════════ */}
      {/* Patterns & data link — content moved into BridgeMomentChips
          carousel above + the existing /port/[id]/advanced page. Diego
          2026-05-02: "insight and data, shouldnt that be a part of
          advanced?" Yes — the deep-data details disclosure that lived
          here is replaced by this one-tap link. Reduces the duplicated
          surface and keeps the page short. */}
      <a
        href={`/port/${encodeURIComponent(portId)}/advanced`}
        className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg leading-none">📊</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {es ? 'Datos detallados' : 'Deep data'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
              {es ? 'Patrón 30 días · breakeven SENTRI · clima · accidentes' : '30-day pattern · SENTRI breakeven · weather · accidents'}
            </p>
          </div>
        </div>
        <span className="flex-shrink-0 text-xs font-bold text-blue-600 dark:text-blue-400">→</span>
      </a>

      {/* Port-specific contextual discovery. Priority-ordered: alerts
          for this bridge (if visited 2+ times), route optimizer (Pro
          users who haven't tried it), share with circle (signed-in
          with saved bridge). One at a time, dismiss to advance. Moved
          to tail 2026-04-21 — was pushing core content down. */}
      <PriorityNudge lang={lang} nudges={PORT_DETAIL_NUDGES} />

      {/* Bilingual FAQ with FAQPage JSON-LD. City-scoped if the port
          belongs to a known rollup city, otherwise shared-only. */}
      <PortFAQ citySlug={cityForPortId(portId) ?? undefined} />

      {!user && !authLoading && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-center shadow-sm">
          <p className="text-base font-bold text-white">
            {es
              ? `🔔 Avísame cuando ${port?.portName || 'este puente'} baje de 30 min`
              : `🔔 Ping me when ${port?.portName || 'this crossing'} drops below 30 min`}
          </p>
          <p className="text-xs text-blue-100 mt-1">
            {es
              ? 'Tu primera alerta es gratis · sin spam · cancela cuando quieras'
              : 'Your first alert is free · no spam · cancel anytime'}
          </p>
          <a
            href="/signup"
            className="inline-block mt-3 bg-white text-blue-700 text-sm font-bold px-6 py-2.5 rounded-full hover:bg-blue-50 transition-colors"
          >
            {es ? 'Activar mi alerta gratis →' : 'Turn on my free alert →'}
          </a>
        </div>
      )}

      {/* Moments-of-want signup modal — opens when guests tap save/alert.
          Threshold inherited from the alert UI's slider so the user's
          intent flows through /signup → /welcome → /api/alerts cleanly. */}
      <BridgeReportSheet
        open={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        portId={portId}
        portName={port.portName}
      />
      <FirstAlertNudge portId={portId} portName={port.portName} />
      <SignupIntentModal
        open={signupModalIntent !== null}
        onClose={() => setSignupModalIntent(null)}
        intent={signupModalIntent ?? 'favorite'}
        portId={portId}
        portName={port.portName}
        defaultThresholdMin={alertThreshold}
        nextPath={`/port/${portId}`}
      />
    </div>
  )
}

// Inline affiliate card — surfaces the two most-relevant border services
// (Mexican auto insurance + eSIM for Mexico) at the moment the user is
// looking at a bridge's wait time. Diego's contextual placement thesis:
// someone staring at /port/[id] is about to cross, so "do you have
// insurance?" lands 10× better than a generic directory link.
function PortDetailAffiliateCard({ portId, es }: { portId: string; es: boolean }) {
  const insurance = getAffiliate('oscar-padilla-auto')
  const esim = getAffiliate('holafly-mexico-esim')
  if (!insurance || !esim) return null

  const offers = [insurance, esim] as const

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
      <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {es ? 'Antes de cruzar' : 'Before you cross'}
      </p>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {offers.map((o) => (
          <a
            key={o.id}
            href={o.url}
            target="_blank"
            rel="sponsored noopener"
            onClick={() =>
              trackEvent('affiliate_clicked', {
                id: o.id,
                category: o.category,
                source: 'port_detail',
                port_id: portId,
              })
            }
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:scale-[0.99]"
          >
            <span className="text-2xl flex-shrink-0" aria-hidden>{o.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {es ? o.headline.es : o.headline.en}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                {es ? o.sub.es : o.sub.en}
              </p>
            </div>
            <span className="flex-shrink-0 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl whitespace-nowrap">
              {es ? o.cta.es : o.cta.en} →
            </span>
          </a>
        ))}
      </div>
      <p className="px-4 py-2 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50">
        {es ? 'Patrocinado · abre en otra pestaña' : 'Sponsored · opens in new tab'}
      </p>
    </div>
  )
}

// Quick crossing verdict — fetches the forecast and compares current
// wait to the historical average for this hour. Shows a one-sentence
// recommendation so the user immediately knows what to do.
function CrossingVerdict({ port, portId, es }: { port: PortWaitTime; portId: string; es: boolean }) {
  const [forecast, setForecast] = useState<{
    bestHour: { hour: number; avgWait: number } | null
    forecast: Array<{ hour: number; avgWait: number | null; delta: string }>
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/forecast?lane=standard`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setForecast(d))
      .catch(() => {})
  }, [portId])

  if (!forecast || !port.vehicle) return null

  const liveWait = port.vehicle
  const nowSlot = forecast.forecast?.[0]
  const avgNow = nowSlot?.avgWait
  const diff = avgNow != null ? liveWait - avgNow : null

  // Find best upcoming slot
  const upcoming = forecast.forecast?.slice(1).filter(f => f.avgWait != null) ?? []
  const bestUpcoming = upcoming.length > 0
    ? upcoming.reduce((a, b) => (b.avgWait ?? 999) < (a.avgWait ?? 999) ? b : a)
    : null
  const savingsMin = bestUpcoming?.avgWait != null ? liveWait - bestUpcoming.avgWait : null

  let verdict: string
  let color: string

  if (liveWait <= 10) {
    verdict = es ? 'Cruza ya — está rápido' : 'Cross now — it\'s fast'
    color = 'bg-emerald-600'
  } else if (savingsMin != null && savingsMin >= 15 && bestUpcoming) {
    const hr = formatHour(bestUpcoming.hour)
    verdict = es
      ? `Espera a las ${hr} — ahorras ~${savingsMin} min`
      : `Wait until ${hr} — save ~${savingsMin} min`
    color = 'bg-amber-600'
  } else if (diff != null && diff > 20) {
    verdict = es ? 'Más lento de lo normal — espera si puedes' : 'Slower than normal — wait if you can'
    color = 'bg-red-600'
  } else if (diff != null && diff < -10) {
    verdict = es ? 'Más rápido de lo normal — buen momento' : 'Faster than normal — good time to cross'
    color = 'bg-emerald-600'
  } else {
    verdict = es ? 'Espera normal para esta hora' : 'Normal wait for this hour'
    color = 'bg-blue-600'
  }

  return (
    <div className={`${color} rounded-2xl px-4 py-3 mb-3`}>
      <p className="text-white text-sm font-black text-center">{verdict}</p>
      {diff != null && Math.abs(diff) >= 5 && (
        <p className="text-white/70 text-[11px] text-center mt-0.5">
          {diff > 0
            ? (es ? `+${diff} min arriba del promedio` : `+${diff} min above average`)
            : (es ? `${diff} min abajo del promedio` : `${diff} min below average`)}
        </p>
      )}
    </div>
  )
}
