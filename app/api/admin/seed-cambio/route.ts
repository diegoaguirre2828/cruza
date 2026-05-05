import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

const PORTS = [
  { id: '230501', lat: 26.1080, lng: -98.2708 },
  { id: '230502', lat: 26.1764, lng: -98.1836 },
  { id: '230503', lat: 26.0432, lng: -98.3647 },
  { id: '230901', lat: 26.0905, lng: -97.9736 },
  { id: '230902', lat: 26.1649, lng: -98.0492 },
  { id: '535501', lat: 25.9007, lng: -97.4935 },
  { id: '535502', lat: 25.8726, lng: -97.4866 },
  { id: '535503', lat: 26.0416, lng: -97.7367 },
  { id: '230401', lat: 27.4994, lng: -99.5076 },
  { id: '230402', lat: 27.5628, lng: -99.5019 },
  { id: '230403', lat: 27.6506, lng: -99.5539 },
]

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestPort(lat: number, lng: number): string | null {
  let best = PORTS[0], bestDist = Infinity
  for (const p of PORTS) {
    const d = haversineKm(lat, lng, p.lat, p.lng)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return bestDist < 60 ? best.id : null
}

// Overpass bounding boxes: RGV, Brownsville, Laredo, + MX side of each
const OVERPASS_QUERY = `
[out:json][timeout:30];
(
  node["amenity"="bureau_de_change"](25.8,-98.6,26.4,-97.7);
  way["amenity"="bureau_de_change"](25.8,-98.6,26.4,-97.7);
  node["amenity"="bureau_de_change"](25.7,-97.7,26.2,-97.3);
  way["amenity"="bureau_de_change"](25.7,-97.7,26.2,-97.3);
  node["amenity"="bureau_de_change"](27.2,-99.9,27.9,-99.2);
  way["amenity"="bureau_de_change"](27.2,-99.9,27.9,-99.2);
  node["shop"="currency_exchange"](25.8,-98.6,26.4,-97.7);
  node["shop"="currency_exchange"](25.7,-97.7,26.2,-97.3);
  node["shop"="currency_exchange"](27.2,-99.9,27.9,-99.2);
);
out center;
`

type OsmElement = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export async function POST(request: Request) {
  // Accept CRON_SECRET (header or query) OR an admin session cookie
  const url = new URL(request.url)
  const secretParam = url.searchParams.get('secret')
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasCronAuth =
    cronSecret && (secretParam === cronSecret || authHeader === `Bearer ${cronSecret}`)

  if (!hasCronAuth) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let elements: OsmElement[] = []
  try {
    const res = await fetch('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(OVERPASS_QUERY),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const json = await res.json()
    elements = json.elements || []
  } catch (e) {
    return NextResponse.json({ error: 'Overpass unreachable', detail: String(e) }, { status: 502 })
  }

  const db = getServiceClient()
  let inserted = 0, skipped = 0

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (!lat || !lon) { skipped++; continue }

    const tags = el.tags || {}
    const name = tags.name || tags['name:es'] || tags['name:en'] || 'Casa de Cambio'

    const { error } = await db.from('cambio_listings').upsert({
      name,
      lat,
      lng: lon,
      port_id: nearestPort(lat, lon),
      city: tags['addr:city'] || null,
      address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || null,
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
      hours: tags.opening_hours || null,
      source: 'osm',
      osm_id: `${el.type}/${el.id}`,
    }, { onConflict: 'osm_id', ignoreDuplicates: true })

    if (error) { skipped++; continue }
    inserted++
  }

  return NextResponse.json({ inserted, skipped, total: elements.length })
}
