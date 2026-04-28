// Calibration log writer — appends a row to the cross-portfolio
// calibration_log table for every prediction. Service-role only.
//
// See supabase/migrations/v63-calibration-log.sql for table shape.
//
// Non-blocking: failures are logged but never thrown — a sim should never
// fail because the log write hiccupped.

import { getServiceClient } from "./supabase";

export type CalibrationProject =
  | "cruzar"
  | "jetstream"
  | "fletcher"
  | "ledger"
  | "stack"
  | "laboral_mx"
  | "bravo";

export interface CalibrationLogInput {
  project: CalibrationProject;
  sim_kind: string; // 'scenario-sim' | 'outcome-sim' | etc.
  sim_version: string; // 'v0', 'v0.4-rf', 'tribe-v2'
  predicted: Record<string, unknown> | unknown[];
  context?: Record<string, unknown>;
  tags?: string[];
}

export async function logCalibrationPrediction(
  entry: CalibrationLogInput,
): Promise<{ id: number | null; ok: boolean; error?: string }> {
  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from("calibration_log")
      .insert({
        project: entry.project,
        sim_kind: entry.sim_kind,
        sim_version: entry.sim_version,
        predicted: entry.predicted,
        context: entry.context ?? null,
        tags: entry.tags ?? [],
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[calibration] insert failed:", error.message);
      return { id: null, ok: false, error: error.message };
    }
    return { id: (data?.id as number) ?? null, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn("[calibration] write threw:", msg);
    return { id: null, ok: false, error: msg };
  }
}
