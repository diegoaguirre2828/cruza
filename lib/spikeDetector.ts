/**
 * Pure spike detection logic for port wait times.
 * Called by /api/cron/detect-spikes.
 *
 * A "spike" is when the current wait significantly exceeds the same-
 * hour-of-week historical baseline for that port+lane.
 *
 * Severity tiers:
 *  - warning : delta >= +20 min AND delta_pct >= 50
 *  - high    : delta >= +30 min AND delta_pct >= 75
 *  - critical: delta >= +45 min AND delta_pct >= 100 (current is 2x baseline)
 *
 * Absolute minimums keep us from flagging "5 → 10 min" as a 100% spike.
 */

export type Lane = "vehicle" | "sentri" | "pedestrian" | "commercial"
export type Severity = "warning" | "high" | "critical"

export interface SpikeInput {
  currentWait: number | null
  baselineWait: number | null
}

export interface SpikeResult {
  isSpike: boolean
  severity: Severity | null
  deltaMinutes: number
  deltaPct: number
}

export function evaluateSpike({ currentWait, baselineWait }: SpikeInput): SpikeResult {
  if (currentWait === null || baselineWait === null) {
    return { isSpike: false, severity: null, deltaMinutes: 0, deltaPct: 0 }
  }
  if (currentWait <= 0 || baselineWait <= 0) {
    return { isSpike: false, severity: null, deltaMinutes: 0, deltaPct: 0 }
  }

  const deltaMinutes = currentWait - baselineWait
  const deltaPct = (deltaMinutes / baselineWait) * 100

  let severity: Severity | null = null
  if (deltaMinutes >= 45 && deltaPct >= 100) severity = "critical"
  else if (deltaMinutes >= 30 && deltaPct >= 75) severity = "high"
  else if (deltaMinutes >= 20 && deltaPct >= 50) severity = "warning"

  return {
    isSpike: severity !== null,
    severity,
    deltaMinutes,
    deltaPct: Number(deltaPct.toFixed(2)),
  }
}

/**
 * Given a list of historical same-hour-of-week readings (minutes),
 * return the median. Minimum 6 samples required; otherwise returns null.
 */
export function medianWait(samples: Array<number | null | undefined>): number | null {
  const clean = samples
    .filter((n): n is number => typeof n === "number" && n >= 0)
    .sort((a, b) => a - b)
  if (clean.length < 6) return null
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 === 0
    ? Math.round((clean[mid - 1] + clean[mid]) / 2)
    : clean[mid]
}

export const LANE_COLUMN: Record<Lane, string> = {
  vehicle: "vehicle_wait",
  sentri: "sentri_wait",
  pedestrian: "pedestrian_wait",
  commercial: "commercial_wait",
}
