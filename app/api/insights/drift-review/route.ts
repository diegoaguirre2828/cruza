// /api/insights/drift-review — 3-persona honest read of /insights claims.
//
// Runs INSIGHTS_TRUST_PERSONAS (Skeptical buyer / Honest broker / Audit
// critic) against a specific port's lift numbers + drift status. Returns
// what each perspective sees — addresses the "+52% is one outlier"
// honesty problem Diego flagged. Buyer-facing, lives on /insights as a
// "what 3 experts say" expandable per-port panel.

import { NextResponse } from "next/server";
import { runPersonaPanel, INSIGHTS_TRUST_PERSONAS } from "@/lib/personaPanel";
import manifest from "@/data/insights-manifest.json";
import { getPortMeta } from "@/lib/portMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ManifestModel {
  port_id: string;
  port_name: string;
  horizon_min: number;
  rmse_min: number | null;
  lift_vs_persistence_pct: number | null;
  lift_vs_cbp_climatology_pct: number | null;
  lift_vs_self_climatology_pct?: number | null;
  n_train: number;
  n_test: number;
}

const MODELS_6H = (manifest as { models: ManifestModel[] }).models.filter(
  (m) => m.horizon_min === 360,
);

export async function POST(req: Request) {
  let body: { port_id?: string } = {};
  try {
    body = (await req.json()) as { port_id?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const portId = (body.port_id ?? "").trim();
  if (!portId) {
    return NextResponse.json({ error: "port_id required" }, { status: 400 });
  }

  const model = MODELS_6H.find((m) => m.port_id === portId);
  if (!model) {
    return NextResponse.json({ error: "port not in v0.5.4 manifest" }, { status: 404 });
  }
  const meta = getPortMeta(portId);

  const cbpAvail = model.lift_vs_cbp_climatology_pct !== null && model.lift_vs_cbp_climatology_pct !== 0;
  const summary = [
    `Port: ${meta?.localName ?? meta?.city ?? portId} (${portId})`,
    `Region: ${meta?.region ?? "?"}`,
    `Model version: v0.5.4`,
    `Training data: n_train=${model.n_train}, n_test=${model.n_test} (≈${Math.round((model.n_train + model.n_test) / 96)} days of 15-min readings)`,
    `RMSE on test window: ${model.rmse_min ?? "?"} minutes`,
    `Lift vs persistence baseline: ${model.lift_vs_persistence_pct?.toFixed(1) ?? "?"}%`,
    `Lift vs CBP climatology: ${cbpAvail ? `${model.lift_vs_cbp_climatology_pct!.toFixed(1)}%` : "CBP doesn't publish climatology for this port"}`,
    `Lift vs self (Cruzar's own DOW × hour avg): ${model.lift_vs_self_climatology_pct?.toFixed(1) ?? "n/a"}%`,
  ].join("\n");

  try {
    const panel = await runPersonaPanel({
      input: [
        "Honest 3-perspective read on whether Cruzar's wait-time forecast for THIS port is worth paying for.",
        "",
        "PORT DATA:",
        "---",
        summary,
        "---",
        "Each persona: from your standpoint, is this port one we should highlight as a win, defer to CBP on, or be honest about the limits?",
        "- Skeptical buyer: would you pay $99-499/mo if this is the kind of result you'll get? What would change your mind?",
        "- Honest broker: have you used this port? Is the lift number defensible vs your daily reality?",
        "- Audit critic: what's misleading here if anything? Cherry-picked window? Sample size? Wrong baseline?",
        "Flag specifics — not vague concerns.",
      ].join("\n"),
      personas: INSIGHTS_TRUST_PERSONAS,
      synthesisInstruction:
        "Give a buyer-facing 1-2 sentence honest read: is this port a 'pay-for-it' win, a 'defers-to-CBP' acknowledgment, or something in between? Use plain language, no marketing fluff.",
      maxTokens: 1500,
    });

    return NextResponse.json({
      panel,
      port_id: portId,
      manifest_snapshot: {
        rmse_min: model.rmse_min,
        lift_vs_persistence_pct: model.lift_vs_persistence_pct,
        lift_vs_cbp_climatology_pct: model.lift_vs_cbp_climatology_pct,
        lift_vs_self_climatology_pct: model.lift_vs_self_climatology_pct ?? null,
        n_train: model.n_train,
        n_test: model.n_test,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "review_failed" },
      { status: 502 },
    );
  }
}
