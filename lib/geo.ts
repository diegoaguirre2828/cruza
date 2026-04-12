// Geographic utilities for geo-gated reports and region detection.

export type LocationConfidence = 'near' | 'nearby' | 'far' | 'unknown'

/**
 * Great-circle distance between two points, in kilometers.
 * Classic haversine. Fine for border-crossing distances.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Classify a distance into a trust bucket for community reports.
 *
 *  - 'near'    (<= 5 km): user is physically at the bridge. Maximum trust.
 *  - 'nearby'  (<= 50 km): user is in the metro area — probably a recent
 *                          crosser who knows the score, still trustworthy.
 *  - 'far'     (> 50 km): user is nowhere near the bridge. Very likely a
 *                          troll, or confused, or the wrong bridge. Dropped.
 *  - 'unknown': no geolocation data. Accepted but weighted down.
 */
export function classifyDistance(km: number | null | undefined): LocationConfidence {
  if (km == null || Number.isNaN(km)) return 'unknown'
  if (km <= 5) return 'near'
  if (km <= 50) return 'nearby'
  return 'far'
}

/**
 * Relative weight of a report in the community consensus blend, based on
 * how confident we are about the reporter's location.
 *
 *   near / nearby  →  3  (treat as ground truth)
 *   unknown        →  1  (default — most reports today have no geo)
 *   far            →  0  (drop entirely)
 */
export function confidenceWeight(confidence: LocationConfidence | string | null | undefined): number {
  if (confidence === 'near' || confidence === 'nearby') return 3
  if (confidence === 'far') return 0
  return 1
}
