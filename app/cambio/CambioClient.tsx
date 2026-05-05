'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { TrendingUp, Phone, Star, Lock } from 'lucide-react'
import { useTier } from '@/lib/useTier'

const CambioMap = dynamic(() => import('@/components/CambioMap'), { ssr: false })

interface Listing {
  id: string
  name: string
  lat: number
  lng: number
  port_id: string | null
  city: string | null
  address: string | null
  phone: string | null
  whatsapp: string | null
  hours: string | null
  website: string | null
  listing_tier: 'free' | 'featured'
  claimed: boolean
  rate: { sell_rate: number; buy_rate: number; reported_at: string } | null
}

function ageLabel(reportedAt: string) {
  const h = (Date.now() - new Date(reportedAt).getTime()) / 3600000
  if (h < 1) return 'Hace menos de 1h'
  if (h < 24) return `Hace ${Math.floor(h)}h`
  return 'Ayer'
}

function ageDot(reportedAt: string) {
  const h = (Date.now() - new Date(reportedAt).getTime()) / 3600000
  if (h < 3) return 'bg-emerald-500'
  if (h < 24) return 'bg-amber-400'
  return 'bg-gray-400'
}

const CORRIDORS = [
  { id: 'reynosa',   label: 'Reynosa / McAllen',       portIds: ['230501', '230502', '230503'], lat: 26.1080, lng: -98.2708 },
  { id: 'matamoros', label: 'Matamoros / Brownsville',  portIds: ['535501', '535502', '535503', '535504'], lat: 25.9007, lng: -97.4935 },
  { id: 'laredo',    label: 'Laredo / Nuevo Laredo',    portIds: ['230401', '230402', '230403'], lat: 27.4994, lng: -99.5076 },
  { id: 'progreso',  label: 'Progreso / Nuevo Progreso', portIds: ['230901', '230902'], lat: 26.0905, lng: -97.9736 },
]

export default function CambioClient() {
  const { tier } = useTier()
  const isPro = tier === 'pro' || tier === 'business'

  const [corridorId, setCorridorId] = useState<string>(CORRIDORS[0].id)
  const [data, setData] = useState<{ listings: Listing[]; officialRate: number | null } | null>(null)
  const [loading, setLoading] = useState(true)

  const corridor = CORRIDORS.find(c => c.id === corridorId) ?? CORRIDORS[0]

  useEffect(() => {
    setLoading(true)
    fetch(`/api/cambio/map?port_ids=${corridor.portIds.join(',')}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [corridorId])

  const listings = data?.listings ?? []
  const officialRate = data?.officialRate
  const best = listings.find(l => l.rate)
  const visibleListings = isPro ? listings : listings.slice(0, 3)

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-black tracking-tight">Tipo de Cambio</h1>
        <p className="text-sm text-white/50 mt-0.5">Las mejores casas de cambio cerca de tu puente</p>

        {/* Official rate banner */}
        {officialRate && (
          <div className="mt-3 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <TrendingUp className="w-4 h-4 text-white/40 shrink-0" />
            <span className="text-xs text-white/50">Banxico referencia</span>
            <span className="ml-auto text-sm font-bold tabular-nums text-white">${officialRate.toFixed(2)} <span className="text-white/40 font-normal">MXN/USD</span></span>
          </div>
        )}
      </div>

      {/* Corridor picker */}
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CORRIDORS.map(c => (
            <button
              key={c.id}
              onClick={() => setCorridorId(c.id)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                corridorId === c.id ? 'bg-white text-gray-900' : 'bg-white/8 text-white/60 hover:bg-white/12'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="mt-4 mx-4 max-w-2xl mx-auto rounded-2xl overflow-hidden border border-white/10" style={{ height: 240 }}>
        {!loading && listings.length > 0 && (
          <CambioMap
            listings={isPro ? listings : listings.slice(0, 3)}
            centerLat={corridor.lat}
            centerLng={corridor.lng}
            bestId={best?.id}
          />
        )}
        {loading && (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Legend */}
      {isPro && (
        <div className="px-4 mt-2 max-w-2xl mx-auto flex items-center gap-4 text-[10px] text-white/40">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Mejor tasa</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Fresca (&lt;3h)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> &lt;24h</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> Sin datos</span>
        </div>
      )}

      {/* Listings */}
      <div className="px-4 mt-4 max-w-2xl mx-auto space-y-2 pb-24">
        {loading && [1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
        ))}

        {!loading && listings.length === 0 && (
          <div className="text-center py-12 text-white/30 text-sm">
            Sin casas de cambio registradas en este puente todavía.
          </div>
        )}

        {visibleListings.map((l, i) => (
          <div key={l.id} className={`bg-white/5 border rounded-2xl p-4 ${l.listing_tier === 'featured' ? 'border-amber-400/40' : 'border-white/8'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {i === 0 && l.rate && <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Mejor</span>}
                  {l.listing_tier === 'featured' && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                  <p className="font-semibold text-sm truncate">{l.name}</p>
                </div>
                {l.address && <p className="text-[11px] text-white/40 mt-0.5 truncate">{l.address}</p>}
                {l.hours && <p className="text-[11px] text-white/30 mt-0.5">{l.hours}</p>}
              </div>

              {l.rate ? (
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-emerald-400 tabular-nums">${l.rate.sell_rate.toFixed(2)}</p>
                  <p className="text-[10px] text-white/40 tabular-nums">compra ${l.rate.buy_rate.toFixed(2)}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${ageDot(l.rate.reported_at)}`} />
                    <span className="text-[10px] text-white/30">{ageLabel(l.rate.reported_at)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-right shrink-0">
                  <p className="text-sm text-white/20 italic">Sin tasa</p>
                  <p className="text-[10px] text-white/20 mt-0.5">Sé el primero</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/6">
              {isPro && (
                <button
                  onClick={() => {
                    const sell = prompt('¿Cuánto pagan por dólar? (venta, ej: 17.45)')
                    if (!sell) return
                    const buy = prompt('¿Cuánto compran? (compra, ej: 17.10)')
                    if (!buy) return
                    fetch('/api/exchange/report', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        house_name: l.name,
                        listing_id: l.id,
                        sell_rate: parseFloat(sell),
                        buy_rate: parseFloat(buy),
                        port_id: l.port_id,
                        city: l.city,
                      }),
                    }).then(() => window.location.reload())
                  }}
                  className="text-[11px] text-white/50 hover:text-white transition-colors"
                >
                  + Reportar tasa
                </button>
              )}
              {l.phone && (
                <a href={`tel:${l.phone}`} className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white transition-colors">
                  <Phone className="w-3 h-3" /> Llamar
                </a>
              )}
              {l.whatsapp && (
                <a
                  href={`https://wa.me/${l.whatsapp.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  WhatsApp
                </a>
              )}
              {!l.claimed && (
                <span className="ml-auto text-[10px] text-white/20 hover:text-white/40 cursor-pointer transition-colors">
                  Reclamar negocio →
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Pro gate */}
        {!isPro && listings.length > 3 && (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f172a] z-10 rounded-2xl" />
            <div className="bg-white/5 border border-white/8 rounded-2xl p-6 text-center">
              <Lock className="w-5 h-5 text-white/30 mx-auto mb-2" />
              <p className="text-sm font-semibold">{listings.length - 3} casas de cambio más</p>
              <p className="text-xs text-white/40 mt-1 mb-3">
                Pro te muestra todas las tasas, el mapa completo, y te deja reportar.
              </p>
              <Link
                href="/pricing"
                className="inline-block bg-white text-gray-900 text-sm font-black px-5 py-2 rounded-xl hover:scale-105 transition-transform"
              >
                Upgrade a Pro — $4.99/mo
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
