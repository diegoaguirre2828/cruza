// NASA EONET (Earth Observatory Natural Event Tracker) integration.
//
// EONET aggregates real-time natural events (wildfires, storms, volcanoes,
// floods, dust/haze, severe weather) from authoritative sources (USGS, NOAA,
// NASA Worldview, etc.). Free, public, no auth.
//
// Why Cruzar uses it: when a port flags >1.5x baseline wait, the broker has
// no immediate explanation for WHY. EONET answers a chunk of those: wildfire
// smoke near Pharr, tropical storm warning at Brownsville, dust event in El
// Paso corridor — all of which are CBP-known precursors to wait spikes.
//
// API: https://eonet.gsfc.nasa.gov/api/v3/events
// Spec: https://eonet.gsfc.nasa.gov/docs/v3
// License: NASA public domain.

const EONET_BASE = "https://eonet.gsfc.nasa.gov/api/v3/events";

export type EonetCategory =
  | "wildfires"
  | "severeStorms"
  | "volcanoes"
  | "drought"
  | "dustHaze"
  | "earthquakes"
  | "floods"
  | "landslides"
  | "manmade"
  | "seaLakeIce"
  | "snow"
  | "tempExtremes"
  | "waterColor";

export interface NearbyNaturalEvent {
  id: string;
  title: string;
  category: string; // e.g. "wildfires"
  category_title: string; // e.g. "Wildfires"
  source: string; // best-guess primary source name
  source_url: string | null;
  distance_km: number; // closest approach to the requested point
  last_observed_at: string; // ISO 8601 of the most recent geometry
  is_closed: boolean;
  // Magnitude when source provides one (e.g. wildfire acreage). null when not.
  magnitude_value: number | null;
  magnitude_unit: string | null;
}

interface EonetGeometry {
  date: string;
  type: "Point" | "Polygon";
  coordinates: unknown;
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
}

interface EonetEvent {
  id: string;
  title: string;
  closed: string | null;
  categories: { id: string; title: string }[];
  sources: { id: string; url: string }[];
  geometry: EonetGeometry[];
}

// Haversine — same shape as lib/transloadYards.ts. Inlined to keep this
// module self-contained / no cross-import.
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Convert a geometry into the closest distance from a target point. Handles
// Point (single coord) and Polygon (array of [lng, lat] pairs — we sample
// vertices, which is good enough at 100km granularity).
function geometryDistanceKm(
  target: { lat: number; lng: number },
  geom: EonetGeometry,
): number {
  if (geom.type === "Point") {
    const c = geom.coordinates as [number, number];
    return haversineKm(target, { lat: c[1], lng: c[0] });
  }
  // Polygon — coordinates is [[ring1], [ring2]]. Each ring is [[lng,lat], ...].
  // We just check vertices of the outer ring; for our 100km radius use case
  // this is a 1-2km error at worst when the closest point of the polygon is
  // along an edge. Fine.
  const rings = geom.coordinates as number[][][];
  if (!rings.length) return Infinity;
  let best = Infinity;
  for (const ring of rings) {
    for (const c of ring) {
      const d = haversineKm(target, { lat: c[1], lng: c[0] });
      if (d < best) best = d;
    }
  }
  return best;
}

// Pick the most recent geometry to surface as "last_observed_at".
function latestGeometry(geom: EonetGeometry[]): EonetGeometry | null {
  if (!geom.length) return null;
  return geom.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b));
}

// Convert km radius into an approximate bbox in degrees. lat: 1deg ≈ 111km.
// lng: 1deg ≈ 111km × cos(lat). We compute the lng correction from the
// requested center latitude so the bbox is accurate enough at any latitude
// between the southern Mexican states and the US northern border.
function bboxAround(
  center: { lat: number; lng: number },
  radiusKm: number,
): string {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  const west = center.lng - dLng;
  const east = center.lng + dLng;
  const north = center.lat + dLat;
  const south = center.lat - dLat;
  // EONET expects "west,south,east,north"
  return `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`;
}

// In-memory cache. Keyed by bbox+days+status; 1-hour TTL. Bounded size to
// avoid memory bloat across many cold-warm function instances.
type CacheEntry = { data: EonetEvent[]; expiresAt: number };
const eventsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_KEYS = 200;

async function fetchEonetEvents(opts: {
  bbox?: string;
  days?: number;
  status?: "open" | "closed" | "all";
  limit?: number;
}): Promise<EonetEvent[]> {
  const bbox = opts.bbox ?? "";
  const days = opts.days ?? 7;
  const status = opts.status ?? "open";
  const limit = opts.limit ?? 50;
  const cacheKey = `${bbox}|${days}|${status}|${limit}`;
  const cached = eventsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = new URL(EONET_BASE);
  if (bbox) url.searchParams.set("bbox", bbox);
  url.searchParams.set("days", String(days));
  url.searchParams.set("status", status);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, {
    headers: {
      "User-Agent": "cruzar/1.0 (https://cruzar.app; diegonaguirre@icloud.com)",
      Accept: "application/json",
    },
    // Vercel/Next caches GETs at the edge for `revalidate` seconds.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    // EONET occasionally 503s during their maintenance windows. Don't take
    // down the dependent endpoint — return empty + warn.
    console.warn(`[eonet] HTTP ${res.status} for ${url.pathname}`);
    return [];
  }
  const json = (await res.json()) as { events?: EonetEvent[] };
  const events = json.events ?? [];

  // LRU-ish eviction
  if (eventsCache.size >= CACHE_MAX_KEYS) {
    const oldest = [...eventsCache.entries()].sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt,
    )[0];
    if (oldest) eventsCache.delete(oldest[0]);
  }
  eventsCache.set(cacheKey, { data: events, expiresAt: Date.now() + CACHE_TTL_MS });
  return events;
}

/**
 * Fetch natural events near a target point. Filters EONET to a bbox around
 * the point + a recency window, then computes the closest approach of each
 * event's geometry to refine to a true radial filter.
 *
 * @param target lat/lng of the port-of-entry (or any reference point)
 * @param radiusKm filter radius — events outside are dropped
 * @param days look-back window (default 7)
 * @param status open | closed | all (default open)
 */
export async function fetchNearbyEvents(
  target: { lat: number; lng: number },
  radiusKm: number = 100,
  days: number = 7,
  status: "open" | "closed" | "all" = "open",
): Promise<NearbyNaturalEvent[]> {
  const bbox = bboxAround(target, radiusKm);
  const events = await fetchEonetEvents({ bbox, days, status, limit: 100 });

  const out: NearbyNaturalEvent[] = [];
  for (const evt of events) {
    if (!evt.geometry.length) continue;
    // Find the geometry with the closest approach to target.
    let bestDist = Infinity;
    for (const g of evt.geometry) {
      const d = geometryDistanceKm(target, g);
      if (d < bestDist) bestDist = d;
    }
    if (bestDist > radiusKm) continue;

    const cat = evt.categories[0];
    const src = evt.sources[0];
    const last = latestGeometry(evt.geometry);
    out.push({
      id: evt.id,
      title: evt.title,
      category: cat?.id ?? "unknown",
      category_title: cat?.title ?? "Unknown",
      source: src?.id ?? "EONET",
      source_url: src?.url ?? null,
      distance_km: Math.round(bestDist * 10) / 10,
      last_observed_at: last?.date ?? "",
      is_closed: evt.closed != null,
      magnitude_value: typeof last?.magnitudeValue === "number" ? last.magnitudeValue : null,
      magnitude_unit: typeof last?.magnitudeUnit === "string" ? last.magnitudeUnit : null,
    });
  }

  // Sort by distance ascending — closest events most relevant.
  out.sort((a, b) => a.distance_km - b.distance_km);
  return out;
}
