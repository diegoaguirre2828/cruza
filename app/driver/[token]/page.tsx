'use client'

import { useState, useEffect, use } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { Navigation, RefreshCw, CheckCircle2, Truck, Clock, AlertTriangle, Share2 } from 'lucide-react'

const CROSSINGS = [
  { portId: '230501', name: 'McAllen / Hidalgo' },
  { portId: '230502', name: 'Pharr–Reynosa' },
  { portId: '230503', name: 'Anzaldúas' },
  { portId: '230901', name: 'Progreso' },
  { portId: '230902', name: 'Donna' },
  { portId: '230701', name: 'Rio Grande City' },
  { portId: '231001', name: 'Roma' },
  { portId: '535501', name: 'Brownsville Gateway' },
  { portId: '535502', name: 'Brownsville Veterans' },
  { portId: '535503', name: 'Los Tomates' },
  { portId: '230401', name: 'Laredo I (Gateway)' },
  { portId: '230402', name: 'Laredo II (Juarez-Lincoln)' },
  { portId: '230403', name: 'Laredo (Colombia)' },
  { portId: '230301', name: 'Eagle Pass I' },
  { portId: '230302', name: 'Eagle Pass II' },
  { portId: '240201', name: 'El Paso' },
  { portId: '250401', name: 'San Ysidro' },
  { portId: '250601', name: 'Otay Mesa' },
]

const STATUS_CONFIG = [
  { key: 'en_route',  emoji: '🚛', label: 'Heading to Bridge', color: 'bg-blue-500 hover:bg-blue-600',    active: 'ring-4 ring-blue-300' },
  { key: 'in_line',   emoji: '🚗', label: 'In Line',           color: 'bg-yellow-500 hover:bg-yellow-600', active: 'ring-4 ring-yellow-300' },
  { key: 'at_bridge', emoji: '🌉', label: 'At the Bridge',     color: 'bg-orange-500 hover:bg-orange-600', active: 'ring-4 ring-orange-300' },
  { key: 'cleared',   emoji: '✅', label: 'Cleared / Crossed', color: 'bg-green-500 hover:bg-green-600',   active: 'ring-4 ring-green-300' },
  { key: 'delivered', emoji: '📦', label: 'Load Delivered',    color: 'bg-gray-500 hover:bg-gray-600',     active: 'ring-4 ring-gray-300' },
]

interface Driver {
  name: string
  carrier: string | null
  company: string | null
  current_status: string
  current_port_id: string | null
  last_checkin_at: string | null
  dispatcher_phone: string | null
}

interface WaitInfo {
  vehicle: number | null
  commercial: number | null
  sentri: number | null
  vehicleLanesOpen: number | null
  commercialLanesOpen: number | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function DriverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { theme } = useTheme()

  const [driver, setDriver] = useState<Driver | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selectedPort, setSelectedPort] = useState(CROSSINGS[0].portId)
  const [waitInfo, setWaitInfo] = useState<WaitInfo | null>(null)
  const [waitLoading, setWaitLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [lastStatus, setLastStatus] = useState<string>('')
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showHomeScreenTip, setShowHomeScreenTip] = useState(false)

  // Load driver info
  useEffect(() => {
    fetch(`/api/driver/checkin?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setLoadError(true); return }
        setDriver(d.driver)
        setLastStatus(d.driver.current_status || '')
        setCheckedInAt(d.driver.last_checkin_at)
        if (d.driver.current_port_id) setSelectedPort(d.driver.current_port_id)
      })
      .catch(() => setLoadError(true))
  }, [token])

  // Show "Add to Home Screen" tip once
  useEffect(() => {
    const seen = localStorage.getItem('cruzar_home_tip')
    if (!seen) setShowHomeScreenTip(true)
  }, [])

  // Load wait times for selected port
  useEffect(() => {
    setWaitLoading(true)
    fetch('/api/ports', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const port = (d.ports || []).find((p: { portId: string }) => p.portId === selectedPort)
        if (port) {
          setWaitInfo({
            vehicle: port.vehicle,
            commercial: port.commercial,
            sentri: port.sentri,
            vehicleLanesOpen: port.vehicleLanesOpen,
            commercialLanesOpen: port.commercialLanesOpen,
          })
        }
        setWaitLoading(false)
      })
      .catch(() => setWaitLoading(false))
  }, [selectedPort])

  async function checkIn(status: string) {
    setSubmitting(status)
    try {
      await fetch('/api/driver/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, status, portId: selectedPort }),
      })
      setLastStatus(status)
      setCheckedInAt(new Date().toISOString())
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)

      // Auto-open WhatsApp to notify dispatcher
      if (driver?.dispatcher_phone) {
        const statusLabel = STATUS_CONFIG.find(s => s.key === status)?.label || status
        const crossing = CROSSINGS.find(c => c.portId === selectedPort)?.name || ''
        const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        const msg = encodeURIComponent(
          `🚛 ${driver.name} — Status Update\n` +
          `📊 ${statusLabel}\n` +
          (crossing ? `📍 ${crossing}\n` : '') +
          `⏰ ${time}\n\n` +
          `Sent via Cruzar`
        )
        window.open(`https://wa.me/${driver.dispatcher_phone}?text=${msg}`, '_blank')
      }
    } finally {
      setSubmitting(null)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold">Invalid or expired link</p>
          <p className="text-gray-400 text-sm mt-1">Ask your dispatcher to resend your driver link.</p>
        </div>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  const portName = CROSSINGS.find(c => c.portId === selectedPort)?.name || selectedPort
  const currentStatusConfig = STATUS_CONFIG.find(s => s.key === lastStatus)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Truck className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Driver Mode · Cruzar</span>
        </div>
        <h1 className="text-xl font-bold text-white">{driver.name}</h1>
        {(driver.company || driver.carrier) && (
          <p className="text-sm text-gray-400 mt-0.5">{driver.company || driver.carrier}</p>
        )}
      </div>

      <div className="px-5 py-5 space-y-5 max-w-lg mx-auto">

        {/* Add to Home Screen tip — shows once */}
        {showHomeScreenTip && (
          <div className="bg-blue-900/40 border border-blue-700 rounded-2xl px-4 py-3 flex items-start gap-3">
            <Share2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-300">Save this page to your home screen</p>
              <p className="text-xs text-blue-400 mt-0.5">Tap Share → "Add to Home Screen" for one-tap check-ins without finding this link again.</p>
            </div>
            <button
              onClick={() => { setShowHomeScreenTip(false); localStorage.setItem('cruzar_home_tip', '1') }}
              className="text-blue-500 text-lg leading-none flex-shrink-0"
            >×</button>
          </div>
        )}

        {/* Current status badge */}
        {currentStatusConfig && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentStatusConfig.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-white">{currentStatusConfig.label}</p>
              {checkedInAt && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeAgo(checkedInAt)} · {portName}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Success flash */}
        {showSuccess && (
          <div className="bg-green-900/40 border border-green-700 rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-400">Status updated</p>
              {driver?.dispatcher_phone && (
                <p className="text-xs text-green-500 mt-0.5">WhatsApp opened — tap Send to notify dispatcher</p>
              )}
            </div>
          </div>
        )}

        {/* Crossing selector */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
            <Navigation className="w-3 h-3" /> Your Crossing
          </label>
          <select
            value={selectedPort}
            onChange={e => setSelectedPort(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CROSSINGS.map(c => <option key={c.portId} value={c.portId}>{c.name}</option>)}
          </select>
        </div>

        {/* Live wait times */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Live Wait — {portName}</p>
          {waitLoading ? (
            <div className="flex gap-2">
              {[1,2,3].map(i => <div key={i} className="flex-1 h-14 bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : waitInfo ? (
            <div className="grid grid-cols-3 gap-2">
              {waitInfo.vehicle !== null && (
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {waitInfo.vehicle === 0 ? '<1' : waitInfo.vehicle}
                  </p>
                  <p className="text-xs text-gray-400">min · Car</p>
                  {waitInfo.vehicleLanesOpen !== null && (
                    <p className="text-xs text-gray-500">{waitInfo.vehicleLanesOpen} lanes</p>
                  )}
                </div>
              )}
              {waitInfo.commercial !== null && (
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {waitInfo.commercial === 0 ? '<1' : waitInfo.commercial}
                  </p>
                  <p className="text-xs text-gray-400">min · Truck</p>
                  {waitInfo.commercialLanesOpen !== null && (
                    <p className="text-xs text-gray-500">{waitInfo.commercialLanesOpen} lanes</p>
                  )}
                </div>
              )}
              {waitInfo.sentri !== null && (
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {waitInfo.sentri === 0 ? '<1' : waitInfo.sentri}
                  </p>
                  <p className="text-xs text-gray-400">min · SENTRI</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">No data available for this crossing</p>
          )}
        </div>

        {/* Status buttons — big, thumb-friendly */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Update Your Status</p>
          <div className="space-y-2.5">
            {STATUS_CONFIG.map(s => (
              <button
                key={s.key}
                onClick={() => checkIn(s.key)}
                disabled={submitting !== null}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60 ${s.color} ${lastStatus === s.key ? s.active : ''}`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <span className="flex-1 text-left">{s.label}</span>
                {submitting === s.key && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
                {lastStatus === s.key && submitting !== s.key && <CheckCircle2 className="w-5 h-5 ml-auto opacity-80" />}
              </button>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-600 text-center pb-4">
          Dispatcher sees your status in real time · Powered by Cruzar
        </p>
      </div>
    </div>
  )
}
