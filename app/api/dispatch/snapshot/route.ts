// /api/dispatch/snapshot — batched dispatcher console feed.
//
// Single round-trip per refresh tick (60s on the client) instead of N
// concurrent requests for live wait + forecast + anomaly per watched port.
//
// Public read — same risk profile as /api/ports. Service-role used only
// for the historical-baseline fallback (no user data exposed).
//
// Query: ?ports=230501,230502,230503  (comma-separated port_ids, max 12)
// Returns: { snapshot: { generated_at, ports: [...] } }

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getPortMeta } from "@/lib/portMeta";
import manifest from "@/data/insights-manifest.json";
import { confidenceBand, loadForecastQuality, shouldShowForecast, type QualityTier } from "@/lib/forecastQuality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PORTS = 12;

interface ManifestModel {
  port_id: string;
  horizon_min: number;
  lift_vs_cbp_climatology_pct: number | null;
  lift_vs_self_climatology_pct?: number | null;
  rmse_min: number | null;
}

interface DispatchPort {
  port_id: string;
  name: string;
  region: string;
  cluster: string;
  live_wait_min: number | null;
  live_recorded_at: string | null;
  live_stale_min: number | null;
  predicted_6h_min: number | null;
  delta_min: number | null; // predicted_6h - now (positive = getting worse)
  anomaly_high: boolean;
  anomaly_ratio: number | null; // current / 90d-DOW×hour-avg
  drift_status:
    | "decision-grade"
    | "marginal"
    | "self-baseline"
    | "marginal-self"
    | "drift-fallback"
    | "untracked";
  has_forecast: boolean;
  // Per-port live calibration quality (last 30d). Computed from the
  // forecast_quality_30d view (v83). UI uses these to suppress unreliable
  // forecasts and render confidence bands on borderline ones.
  forecast_quality: QualityTier;
  forecast_mae_min: number | null;        // measured mean absolute error (last 30d)
  forecast_best_model: string | null;     // sim_version routed (RF vs climatology fallback)
  predicted_6h_low_min: number | null;    // confidence band low (predicted - 1σ)
  predicted_6h_high_min: number | null;   // confidence band high (predicted + 1σ)
}

const MODELS_6H = (manifest as { models: ManifestModel[] }).models.filter(
  (m) => m.horizon_min === 360,
);
const MODEL_LOOKUP = new Map(MODELS_6H.map((m) => [m.port_id, m]));

function deriveDriftStatus(model: ManifestModel | undefined): DispatchPort["drift_status"] {
  if (!model) return "untracked";
  const cbp = model.lift_vs_cbp_climatology_pct;
  const self = model.lift_vs_self_climatology_pct ?? null;
  const cbpAvail = cbp !== null && cbp !== 0;
  if (cbpAvail) {
    if (cbp! >= 5) return "decision-grade";
    if (cbp! > 0) return "marginal";
    return "drift-fallback";
  }
  if (self !== null) {
    if (self >= 5) return "self-baseline";
    if (self > 0) return "marginal-self";
    return "drift-fallback";
  }
  return "untracked";
}

async function fetchLive(portIds: string[]): Promise<Map<string, { wait: number | null; recordedAt: string | null }>> {
  // Hit our own /api/ports server-side. Reuses the existing CBP+camera+
  // community blend logic instead of duplicating it here.
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.cruzar.app";
  try {
    const res = await fetch(`${base}/api/ports`, { next: { revalidate: 30 } });
    if (!res.ok) return new Map();
    const json = await res.json();
    const ports = (json?.ports ?? []) as Array<{
      portId: string;
      vehicle: number | null;
      recordedAt: string | null;
    }>;
    const map = new Map<string, { wait: number | null; recordedAt: string | null }>();
    for (const p of ports) {
      if (portIds.includes(p.portId)) {
        map.set(p.portId, { wait: p.vehicle ?? null, recordedAt: p.recordedAt ?? null });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function fetchAnomaly(
  db: ReturnType<typeof getServiceClient>,
  portId: string,
  liveWait: number | null,
): Promise<{ high: boolean; ratio: number | null }> {
  if (typeof liveWait !== "number") return { high: false, ratio: null };
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("wait_time_readings")
    .select("vehicle_wait")
    .eq("port_id", portId)
    .eq("day_of_week", dow)
    .eq("hour_of_day", hour)
    .gte("recorded_at", ninetyDaysAgo)
    .limit(2000);
  const vals = (data || [])
    .map((r) => (r as { vehicle_wait: number | null }).vehicle_wait)
    .filter((v): v is number => typeof v === "number");
  if (vals.length < 5) return { high: false, ratio: null };
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg <= 0) return { high: false, ratio: null };
  const ratio = liveWait / avg;
  return { high: ratio >= 1.5, ratio };
}

async function fetchPredicted6h(portId: string): Promise<number | null> {
  // Hit our own /api/predictions for the 6h-ahead value. /api/predictions
  // returns hourly out to 24h; we pull the closest-to-+6h sample.
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.cruzar.app";
  try {
    const res = await fetch(`${base}/api/predictions?portId=${portId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const preds = (json?.predictions ?? []) as Array<{
      datetime: string;
      predictedWait: number | null;
    }>;
    const targetMs = Date.now() + 6 * 60 * 60 * 1000;
    let best: (typeof preds)[0] | null = null;
    let bestDelta = Infinity;
    for (const p of preds) {
      const d = Math.abs(new Date(p.datetime).getTime() - targetMs);
      if (d < bestDelta) {
        bestDelta = d;
        best = p;
      }
    }
    return best?.predictedWait ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const portsParam = url.searchParams.get("ports") ?? "";
  const portIds = portsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_PORTS);

  if (portIds.length === 0) {
    return NextResponse.json({ snapshot: { generated_at: new Date().toISOString(), ports: [] } });
  }

  const db = getServiceClient();
  const [liveMap, qualityMap] = await Promise.all([
    fetchLive(portIds),
    loadForecastQuality(),
  ]);

  const ports: DispatchPort[] = await Promise.all(
    portIds.map(async (portId) => {
      const meta = getPortMeta(portId);
      const live = liveMap.get(portId) ?? { wait: null, recordedAt: null };
      const model = MODEL_LOOKUP.get(portId);
      const drift_status = deriveDriftStatus(model);
      const quality = qualityMap.get(portId);
      const [anomaly, rawPredicted_6h_min] = await Promise.all([
        fetchAnomaly(db, portId, live.wait),
        fetchPredicted6h(portId),
      ]);
      // Hide forecasts for ports where calibration MAE > 40min — would erode
      // broker trust to display garbage. Per the 2026-05-03 honest audit.
      const predicted_6h_min = shouldShowForecast(quality) ? rawPredicted_6h_min : null;
      const band = confidenceBand(predicted_6h_min, quality);
      const live_stale_min = live.recordedAt
        ? Math.round((Date.now() - new Date(live.recordedAt).getTime()) / 60000)
        : null;
      const delta =
        typeof live.wait === "number" && typeof predicted_6h_min === "number"
          ? predicted_6h_min - live.wait
          : null;
      return {
        port_id: portId,
        name: meta?.localName ?? meta?.city ?? portId,
        region: meta?.region ?? "",
        cluster: meta?.megaRegion ?? "other",
        live_wait_min: live.wait,
        live_recorded_at: live.recordedAt,
        live_stale_min,
        predicted_6h_min,
        delta_min: delta,
        anomaly_high: anomaly.high,
        anomaly_ratio: anomaly.ratio,
        drift_status,
        has_forecast: !!model && shouldShowForecast(quality),
        forecast_quality: quality?.tier ?? "unscored",
        forecast_mae_min: quality?.mae_min ?? null,
        forecast_best_model: quality?.best_model ?? null,
        predicted_6h_low_min: band.low,
        predicted_6h_high_min: band.high,
      };
    }),
  );

  return NextResponse.json(
    { snapshot: { generated_at: new Date().toISOString(), ports } },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
  );
}
