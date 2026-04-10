'use client'

import { useState, useEffect, use } from 'react'
import { CheckCircle, Truck, MapPin, Clock, Navigation } from 'lucide-react'

interface Driver {
  id: string
  name: string
  carrier: string | null
  current_status: string
  current_port_id: string | null
  last_checkin_at: string | null
}

const STATUSES = [
  { key: 'en_route',   label: 'En Camino',    labelEn: 'En Route',      emoji: '🚛', color: 'bg-blue-500',   desc: 'Yendo al cruce / Heading to crossing' },
  { key: 'in_line',    label: 'En Fila',      labelEn: 'In Line',       emoji: '⏳', color: 'bg-yellow-500', desc: 'Esperando en la fila / Waiting in line' },
  { key: 'at_bridge',  label: 'En el Puente', labelEn: 'At the Bridge', emoji: '🌉', color: 'bg-orange-500', desc: 'Cruzando ahora / Crossing now' },
  { key: 'cleared',    label: 'Pasé',         labelEn: 'Cleared',       emoji: '✅', color: 'bg-green-500',  desc: 'Crucé con éxito / Crossed successfully' },
  { key: 'delivered',  label: 'Entregado',    labelEn: 'Delivered',     emoji: '📦', color: 'bg-gray-600',   desc: 'Carga entregada / Load delivered' },
]

const PORT_NAMES: Record<string, string> = {
  '230501': 'Hidalgo – McAllen',
  '230502': 'Pharr – Reynosa',
  '230503': 'McAllen – Anzaldúas',
  '230401': 'Laredo I – Gateway',
  '230402': 'Laredo II – World Trade',
  '230403': 'Laredo III – Colombia',
  '230404': 'Laredo IV – Juárez-Lincoln',
  '535501': 'Brownsville – Gateway',
  '535502': 'Brownsville – Veterans',
  '535503': 'Brownsville – B&M',
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'justo ahora / just now'
  if (mins < 60) return `hace ${mins} min`
  return `hace ${Math.round(mins / 60)}h`
}

export default function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [selectedPort, setSelectedPort] = useState('')
  const [showPortPicker, setShowPortPicker] = useState(false)

  useEffect(() => {
    fetch(`/api/checkin?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setDriver(d.driver)
          setSelectedPort(d.driver.current_port_id || '')
        }
      })
      .catch(() => setError('No se pudo cargar / Could not load'))
      .finally(() => setLoading(false))
  }, [token])

  async function updateStatus(status: string) {
    setUpdating(true)
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, status, portId: selectedPort || null }),
    })
    if (res.ok) {
      setDriver(prev => prev ? { ...prev, current_status: status, last_checkin_at: new Date().toISOString() } : prev)
      setUpdated(true)
      setTimeout(() => setUpdated(false), 3000)
    }
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !driver) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">❌</p>
          <p className="text-white font-bold text-lg">Enlace inválido</p>
          <p className="text-gray-400 text-sm mt-1">Invalid check-in link</p>
          <p className="text-gray-500 text-xs mt-3">Pide un nuevo enlace a tu despachador.<br/>Ask your dispatcher for a new link.</p>
        </div>
      </div>
    )
  }

  const currentStatus = STATUSES.find(s => s.key === driver.current_status)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-sm mx-auto px-4 pb-10">
        {/* Header */}
        <div className="pt-8 pb-6 text-center">
          <p className="text-3xl mb-2">🚛</p>
          <h1 className="text-xl font-bold">{driver.name}</h1>
          {driver.carrier && <p className="text-gray-400 text-sm mt-0.5">{driver.carrier}</p>}
        </div>

        {/* Current status */}
        {currentStatus && (
          <div className={`rounded-2xl p-4 mb-5 text-center ${currentStatus.color} bg-opacity-20 border border-white/10`}>
            <p className="text-3xl mb-1">{currentStatus.emoji}</p>
            <p className="font-bold text-lg">{currentStatus.label}</p>
            <p className="text-sm opacity-80">{currentStatus.labelEn}</p>
            {driver.last_checkin_at && (
              <p className="text-xs opacity-60 mt-1">Actualizado {timeAgo(driver.last_checkin_at)}</p>
            )}
          </div>
        )}

        {/* Success flash */}
        {updated && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-3 mb-4 text-center">
            <p className="text-sm font-semibold text-green-400">✓ Estado actualizado / Status updated</p>
          </div>
        )}

        {/* Port selector */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">
            ¿En qué cruce? / Which crossing?
          </p>
          <button
            onClick={() => setShowPortPicker(!showPortPicker)}
            className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className={selectedPort ? 'text-white' : 'text-gray-400'}>
                {selectedPort ? (PORT_NAMES[selectedPort] || selectedPort) : 'Seleccionar cruce / Select crossing'}
              </span>
            </div>
            <span className="text-gray-500 text-xs">{showPortPicker ? '▲' : '▼'}</span>
          </button>

          {showPortPicker && (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl mt-1 overflow-hidden">
              <button
                onClick={() => { setSelectedPort(''); setShowPortPicker(false) }}
                className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-gray-700 border-b border-gray-700"
              >
                — Sin cruce específico / No specific crossing —
              </button>
              {Object.entries(PORT_NAMES).map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => { setSelectedPort(id); setShowPortPicker(false) }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-700 ${selectedPort === id ? 'text-blue-400 bg-gray-700' : 'text-white'}`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status buttons */}
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">
          Actualizar estado / Update status
        </p>
        <div className="space-y-2">
          {STATUSES.map(s => (
            <button
              key={s.key}
              onClick={() => updateStatus(s.key)}
              disabled={updating || driver.current_status === s.key}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                driver.current_status === s.key
                  ? `${s.color} bg-opacity-30 border-white/20 opacity-100`
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700 active:scale-95'
              } ${updating ? 'opacity-50' : ''}`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <div className="text-left">
                <p className="font-bold text-sm">{s.label} · {s.labelEn}</p>
                <p className="text-xs text-gray-400">{s.desc}</p>
              </div>
              {driver.current_status === s.key && (
                <CheckCircle className="w-5 h-5 text-white ml-auto" />
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">
          Powered by Cruzar · cruzar.app
        </p>
      </div>
    </div>
  )
}
