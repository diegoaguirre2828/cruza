// /api/dispatch/recommend — load enrichment endpoint.
//
// POST body: { origin_lat, origin_lng, receiver_lat?, receiver_lng?,
//              appt_at?, cargo_type?, candidate_port_ids?: string[] }
//
// For each candidate port:
//  1. compute drive_min from origin (haversine × 1.4 / 65 mph)
//  2. fetch our 6h ML forecast for the port (manifest-driven via /api/predictions)
//  3. compute estimated_arrival_at = now + drive_min
//  4. compute total_eta_min = drive_min + predicted_wait_at_arrival
//  5. estimate detention_$_at_risk if appt_at given and total_eta exceeds appt
//  6. rank by total_eta_min ascending
//
// Returns top-3 + driver SMS template per pick.

import { NextResponse } from "next/server";
import { PORT_META } from "@/lib/portMeta";
import manifest from "@/data/insights-manifest.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CANDIDATES = [
  "230501", "230502", "230503", "230901", "230902",
  "535501", "535502", "535503", "230401", "230402",
  "230403", "240201", "240202", "240301",
];
const DETENTION_RATE_USD_PER_HR = 85;

interface ManifestModel {
  port_id: string;
  horizon_min: number;
  rmse_min: number | null;
  lift_vs_cbp_climatology_pct: number | null;
}

const MODELS_6H = (manifest as { models: ManifestModel[] }).models.filter(
  (m) => m.horizon_min === 360,
);
const MODEL_LOOKUP = new Map(MODELS_6H.map((m) => [m.port_id, m]));

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function fetch6hForecast(portId: string, atMs: number): Promise<number | null> {
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
    let best: (typeof preds)[0] | null = null;
    let bestDelta = Infinity;
    for (const p of preds) {
      const d = Math.abs(new Date(p.datetime).getTime() - atMs);
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

interface RecommendInput {
  origin_lat?: number;
  origin_lng?: number;
  receiver_lat?: number;
  receiver_lng?: number;
  appt_at?: string; // ISO
  cargo_type?: string;
  candidate_port_ids?: string[];
  driver_name?: string;
}

interface RecommendPort {
  port_id: string;
  name: string;
  region: string;
  drive_km: number;
  drive_min: number;
  predicted_wait_at_arrival_min: number | null;
  total_eta_min: number | null;
  estimated_arrival_at: string;
  detention_usd_at_risk: number | null;
  driver_sms: string;
}

export async function POST(req: Request) {
  let body: RecommendInput = {};
  try {
    body = (await req.json()) as RecommendInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { origin_lat, origin_lng, appt_at, candidate_port_ids, driver_name } = body;
  if (typeof origin_lat !== "number" || typeof origin_lng !== "number") {
    return NextResponse.json({ error: "origin_lat and origin_lng required" }, { status: 400 });
  }

  const candidates = (candidate_port_ids && candidate_port_ids.length > 0
    ? candidate_port_ids
    : DEFAULT_CANDIDATES
  ).filter((id) => PORT_META[id] && MODEL_LOOKUP.has(id));

  const apptMs = appt_at ? new Date(appt_at).getTime() : null;
  const now = Date.now();

  const picks: RecommendPort[] = await Promise.all(
    candidates.map(async (id) => {
      const meta = PORT_META[id];
      const drive_km = haversineKm(origin_lat, origin_lng, meta.lat, meta.lng);
      const drive_min = Math.round((drive_km * 1.4) / 65 * 60); // crow-flies → road heuristic, 65 mph
      const arrivalMs = now + drive_min * 60_000;
      const predicted = await fetch6hForecast(id, arrivalMs);
      const total =
        typeof predicted === "number" ? drive_min + predicted : null;
      const detention =
        apptMs && typeof total === "number" && now + total * 60_000 > apptMs
          ? Math.round(((now + total * 60_000 - apptMs) / 3_600_000) * DETENTION_RATE_USD_PER_HR)
          : null;
      const driverNamePrefix = driver_name ? `Hey ${driver_name} — ` : "";
      const driver_sms = `${driverNamePrefix}cross at ${meta.localName ?? meta.city}. ETA ${drive_min} min drive + ${predicted ?? "?"} min wait = ${total ?? "?"} min total. -Cruzar`;
      return {
        port_id: id,
        name: meta.localName ?? meta.city,
        region: meta.region,
        drive_km: Math.round(drive_km * 10) / 10,
        drive_min,
        predicted_wait_at_arrival_min: predicted,
        total_eta_min: total,
        estimated_arrival_at: new Date(arrivalMs).toISOString(),
        detention_usd_at_risk: detention,
        driver_sms,
      };
    }),
  );

  // Sort by total_eta_min ascending; nulls go last
  picks.sort((a, b) => {
    if (a.total_eta_min === null) return 1;
    if (b.total_eta_min === null) return -1;
    return a.total_eta_min - b.total_eta_min;
  });

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    inputs: { origin_lat, origin_lng, appt_at, cargo_type: body.cargo_type ?? null },
    picks: picks.slice(0, 5),
  });
}
