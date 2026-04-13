// Cluster-based weather fetching for the fetch-wait-times cron.
//
// The US-Mexico border spans ~1,800 km from Tijuana to Brownsville,
// with 50+ ports of entry. Fetching weather per-port every 15 min
// would mean 50+ Open-Meteo calls per cron run, which is wasteful
// and rate-limit-unfriendly. Instead we group the ports into ~8
// geographic clusters and make one weather call per cluster, then
// assign each port the weather of its nearest cluster.
//
// Clusters are picked to be tight enough that one reading applies
// to every port in them (ports within ~50 km share weather) but
// loose enough to keep the total API call count ≤ 8 per run.

import { getPortMeta } from './portMeta'

export interface ClusterWeather {
  tempC: number | null
  precipMm: number | null
  windKph: number | null
  visibilityKm: number | null
  condition: string | null // open-meteo weather_code lookup label
}

interface Cluster {
  key: string
  lat: number
  lng: number
  label: string
}

const CLUSTERS: Cluster[] = [
  { key: 'rgv',          lat: 26.20, lng: -98.23,  label: 'RGV / McAllen' },
  { key: 'brownsville',  lat: 25.92, lng: -97.50,  label: 'Brownsville / Matamoros' },
  { key: 'laredo',       lat: 27.54, lng: -99.50,  label: 'Laredo / Nuevo Laredo' },
  { key: 'eagle_pass',   lat: 28.71, lng: -100.50, label: 'Eagle Pass / Piedras Negras' },
  { key: 'del_rio',      lat: 29.36, lng: -100.90, label: 'Del Rio / Acuña' },
  { key: 'el_paso',      lat: 31.76, lng: -106.49, label: 'El Paso / Juárez' },
  { key: 'nogales',      lat: 31.34, lng: -110.94, label: 'Nogales / Sonora' },
  { key: 'san_luis',     lat: 32.49, lng: -114.79, label: 'San Luis / Yuma' },
  { key: 'mexicali',     lat: 32.65, lng: -115.47, label: 'Mexicali / Calexico' },
  { key: 'tijuana',      lat: 32.54, lng: -117.03, label: 'Tijuana / San Ysidro' },
]

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Open-Meteo weather_code → short human label. We only store the label
// for analytics/readability; the numeric weather fields are the real
// data we'll be correlating against wait times.
function conditionFor(code: number | null | undefined): string | null {
  if (code == null) return null
  if (code === 0) return 'clear'
  if (code <= 3) return 'partly_cloudy'
  if (code <= 48) return 'fog'
  if (code <= 57) return 'drizzle'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'rain_showers'
  if (code <= 86) return 'snow_showers'
  if (code <= 99) return 'thunderstorm'
  return null
}

async function fetchCluster(cluster: Cluster): Promise<ClusterWeather | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${cluster.lat}&longitude=${cluster.lng}` +
    `&current=temperature_2m,precipitation,wind_speed_10m,visibility,weather_code` +
    `&wind_speed_unit=kmh&timezone=auto`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const cur = data?.current
    if (!cur) return null
    return {
      tempC: typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null,
      precipMm: typeof cur.precipitation === 'number' ? cur.precipitation : null,
      windKph: typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : null,
      // Open-Meteo visibility is in meters — convert to km.
      visibilityKm: typeof cur.visibility === 'number' ? cur.visibility / 1000 : null,
      condition: conditionFor(typeof cur.weather_code === 'number' ? cur.weather_code : null),
    }
  } catch {
    return null
  }
}

// Fetch weather for every cluster in parallel. Returns a map keyed by
// cluster key. Nulls for clusters whose API call failed — we don't
// block the whole cron run on one bad response.
export async function fetchAllClusterWeather(): Promise<Map<string, ClusterWeather>> {
  const results = await Promise.all(
    CLUSTERS.map(async (c) => ({ key: c.key, weather: await fetchCluster(c) })),
  )
  const map = new Map<string, ClusterWeather>()
  for (const r of results) {
    if (r.weather) map.set(r.key, r.weather)
  }
  return map
}

// Given a port ID, pick the nearest cluster and return its weather
// reading from the prefetched map. Returns null if the port's
// coordinates are unknown or no cluster has current weather.
export function weatherForPort(
  portId: string,
  weatherMap: Map<string, ClusterWeather>,
): ClusterWeather | null {
  const meta = getPortMeta(portId)
  if (!meta.lat || !meta.lng) return null
  let best: { cluster: Cluster; dist: number } | null = null
  for (const c of CLUSTERS) {
    const d = haversineKm(meta.lat, meta.lng, c.lat, c.lng)
    if (!best || d < best.dist) best = { cluster: c, dist: d }
  }
  if (!best) return null
  return weatherMap.get(best.cluster.key) || null
}
