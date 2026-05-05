'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface Listing {
  id: string
  name: string
  lat: number
  lng: number
  listing_tier: 'free' | 'featured'
  rate: { sell_rate: number; buy_rate: number; reported_at: string } | null
  phone: string | null
  address: string | null
  hours: string | null
}

interface Props {
  listings: Listing[]
  centerLat?: number
  centerLng?: number
  bestId?: string
}

function rateAge(reportedAt: string): 'fresh' | 'stale' | 'old' {
  const h = (Date.now() - new Date(reportedAt).getTime()) / 3600000
  if (h < 3) return 'fresh'
  if (h < 24) return 'stale'
  return 'old'
}

export default function CambioMap({ listings, centerLat = 26.108, centerLng = -98.27, bestId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return

    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false })
      .setView([centerLat, centerLng], 13)
    instanceRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    for (const l of listings) {
      const isBest = l.id === bestId
      const age = l.rate ? rateAge(l.rate.reported_at) : null
      const color = isBest ? '#22c55e' : age === 'fresh' ? '#3b82f6' : age === 'stale' ? '#f59e0b' : '#6b7280'
      const size = isBest ? 36 : 28

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;
          background:${color};border:2px solid white;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:${isBest ? 11 : 9}px;font-weight:700;color:white;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          ${isBest ? 'outline:3px solid #22c55e;outline-offset:2px;' : ''}
        ">${l.rate ? l.rate.sell_rate.toFixed(2) : '?'}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const popup = `
        <div style="font-family:system-ui;font-size:13px;min-width:160px">
          <p style="font-weight:700;margin:0 0 4px">${l.name}${l.listing_tier === 'featured' ? ' ⭐' : ''}</p>
          ${l.rate ? `
            <p style="margin:0;color:#16a34a">Venta: <strong>$${l.rate.sell_rate.toFixed(2)}</strong> MXN/USD</p>
            <p style="margin:0;color:#2563eb">Compra: <strong>$${l.rate.buy_rate.toFixed(2)}</strong> MXN/USD</p>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280">
              ${new Date(l.rate.reported_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
            </p>
          ` : '<p style="margin:0;color:#9ca3af;font-size:11px">Sin tasa reportada hoy</p>'}
          ${l.address ? `<p style="margin:4px 0 0;font-size:11px;color:#6b7280">${l.address}</p>` : ''}
          ${l.hours ? `<p style="margin:2px 0 0;font-size:11px;color:#6b7280">${l.hours}</p>` : ''}
        </div>`

      L.marker([l.lat, l.lng], { icon }).addTo(map).bindPopup(popup)
    }

    return () => { map.remove(); instanceRef.current = null }
  }, [listings, centerLat, centerLng, bestId])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
