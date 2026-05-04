// lib/forecastQuality.ts
// Per-port forecast quality lookup. Reads from forecast_quality_30d view (v83).
// Used by /dispatch + /insights to gate which forecasts get shown — we'd
// rather show "live data only" than display garbage and erode broker trust.

import { getServiceClient } from './supabase';

export type QualityTier = 'reliable' | 'borderline' | 'unreliable' | 'unscored';

export interface PortForecastQuality {
  port_id: string;
  best_model: string;          // sim_version with lowest MAE for this port
  mae_min: number;
  std_min: number;
  tier: QualityTier;
  preds_scored: number;
}

const RELIABLE_MAE_THRESHOLD = 20;
const UNRELIABLE_MAE_THRESHOLD = 40;
const MIN_SCORED_FOR_TIER = 50;

let cache: { fetchedAt: number; map: Map<string, PortForecastQuality> } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — quality changes slowly

interface ViewRow {
  port_id: string;
  sim_version: string;
  mae_min: number | null;
  std_min: number | null;
  preds_scored: number;
  quality_tier: QualityTier;
}

function tierFor(mae: number | null, scored: number): QualityTier {
  if (mae === null || scored < MIN_SCORED_FOR_TIER) return 'unscored';
  if (mae <= RELIABLE_MAE_THRESHOLD) return 'reliable';
  if (mae <= UNRELIABLE_MAE_THRESHOLD) return 'borderline';
  return 'unreliable';
}

export async function loadForecastQuality(opts: { force?: boolean } = {}): Promise<Map<string, PortForecastQuality>> {
  const now = Date.now();
  if (cache && !opts.force && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.map;
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from('forecast_quality_30d')
    .select('port_id, sim_version, mae_min, std_min, preds_scored, quality_tier');

  if (error || !data) {
    // On view query failure, return empty map — callers fall back to "no
    // quality info" semantics (display forecast as-is).
    return new Map();
  }

  // Pick the BEST (lowest MAE) model per port. This implements per-port
  // fallback: if cbp_climatology_fallback beats v0.4_RF for a port, route to
  // climatology automatically.
  const byPort = new Map<string, ViewRow>();
  for (const row of data as ViewRow[]) {
    if (row.preds_scored < MIN_SCORED_FOR_TIER) continue;
    if (row.mae_min === null) continue;
    const existing = byPort.get(row.port_id);
    if (!existing || (existing.mae_min !== null && row.mae_min < existing.mae_min)) {
      byPort.set(row.port_id, row);
    }
  }

  const map = new Map<string, PortForecastQuality>();
  for (const [port_id, row] of byPort) {
    map.set(port_id, {
      port_id,
      best_model: row.sim_version,
      mae_min: Number(row.mae_min ?? 0),
      std_min: Number(row.std_min ?? 0),
      tier: tierFor(row.mae_min, row.preds_scored),
      preds_scored: row.preds_scored,
    });
  }

  cache = { fetchedAt: now, map };
  return map;
}

export function shouldShowForecast(quality: PortForecastQuality | undefined): boolean {
  if (!quality) return true;                  // no data yet — show as-is
  if (quality.tier === 'unreliable') return false;
  return true;
}

export function confidenceBand(value: number | null, quality: PortForecastQuality | undefined): { low: number | null; high: number | null } {
  if (value === null || !quality || quality.std_min === 0) return { low: null, high: null };
  // Use 1.0 × std as 68% band (conservative, reads as "± std" to a broker).
  const std = quality.std_min;
  return {
    low: Math.max(0, Math.round(value - std)),
    high: Math.round(value + std),
  };
}
